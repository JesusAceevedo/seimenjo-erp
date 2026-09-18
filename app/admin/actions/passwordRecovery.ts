'use server';

import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

function getSmtpTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (!smtpUser || !smtpPass) {
    throw new Error('El servicio de correo SMTP no está configurado en las variables de entorno.');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

/**
 * Busca un usuario en Supabase Auth por su correo electrónico.
 */
async function findUserByEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users || data.users.length === 0) break;

    const user = data.users.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
    if (user) return user;

    if (data.users.length < 100) break;
    page++;
  }

  return null;
}

/**
 * 1. Genera un código de 6 dígitos y lo envía al correo del usuario.
 */
export async function solicitarCodigoRecuperacion(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Por favor ingresa un correo electrónico válido.' };
    }

    // 1. Buscar usuario en Auth
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return {
        success: false,
        error: 'No se encontró ninguna cuenta registrada con este correo electrónico.'
      };
    }

    // 2. Generar código numérico de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    // 3. Guardar en user_metadata del usuario
    const updatedMetadata = {
      ...(user.user_metadata || {}),
      recovery_code: code,
      recovery_expires: expiresAt
    };

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: updatedMetadata
    });

    if (updateErr) {
      console.error('Error guardando código de recuperación:', updateErr);
      return { success: false, error: 'Error al generar el código de seguridad. Intenta nuevamente.' };
    }

    // 4. Enviar correo electrónico con el código
    const nombreUsuario = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario';
    const transporter = getSmtpTransporter();

    const fromAddress = process.env.SMTP_FROM || `"Playa Seimenjo ERP" <${process.env.SMTP_USER || 'facturacionsakuraramen@gmail.com'}>`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
        <h2 style="color: #d97706; margin-top: 0; margin-bottom: 8px; font-size: 20px; font-weight: bold;">
          Recuperación de Contraseña
        </h2>
        <p style="font-size: 14px; margin-bottom: 14px; color: #4b5563;">
          Hola <strong>${nombreUsuario}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.5; margin-bottom: 20px; color: #4b5563;">
          Recibimos una solicitud para restablecer la contraseña de acceso a tu cuenta en el portal de <strong>SEIMENJO</strong>.
        </p>

        <div style="background-color: #fffbeb; border: 1px dashed #f59e0b; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #b45309; letter-spacing: 1px; display: block; margin-bottom: 6px;">
            Tu código de verificación
          </span>
          <span style="font-size: 32px; font-family: 'Courier New', monospace; font-weight: 900; letter-spacing: 8px; color: #d97706; display: block;">
            ${code}
          </span>
        </div>

        <p style="font-size: 12px; color: #6b7280; line-height: 1.4; margin-bottom: 20px;">
          ⏱️ Este código es válido durante los próximos <strong>15 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
          Playa Seimenjo ERP • Seguridad de Cuentas
        </p>
      </div>
    `;

    const plainText = `Hola ${nombreUsuario},\n\nTu código de recuperación para el portal SEIMENJO es: ${code}\n\nEste código expira en 15 minutos.\nSi no solicitaste este cambio, ignora este mensaje.\n\nPlaya Seimenjo ERP`;

    await transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: `${code} es tu código de recuperación - SEIMENJO`,
      text: plainText,
      html: htmlContent
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error en solicitarCodigoRecuperacion:', err);
    return { success: false, error: err.message || 'Error al enviar el código de recuperación.' };
  }
}

/**
 * 2. Valida el código de 6 dígitos y actualiza la contraseña en Supabase Auth.
 */
export async function verificarCodigoYCambiarPassword(
  email: string,
  codigo: string,
  nuevaPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (codigo || '').trim();

    if (!cleanEmail || !cleanCode) {
      return { success: false, error: 'Por favor completa todos los campos requeridos.' };
    }

    if (!nuevaPassword || nuevaPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    // 1. Buscar usuario
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    const savedCode = user.user_metadata?.recovery_code;
    const expiresAt = user.user_metadata?.recovery_expires;

    if (!savedCode || !expiresAt) {
      return {
        success: false,
        error: 'No hay un código de recuperación activo para esta cuenta. Solicita uno nuevo.'
      };
    }

    if (Date.now() > Number(expiresAt)) {
      return {
        success: false,
        error: 'El código de seguridad ha expirado. Por favor solicita uno nuevo.'
      };
    }

    if (savedCode.toString() !== cleanCode) {
      return {
        success: false,
        error: 'El código de verificación ingresado es incorrecto.'
      };
    }

    // 2. Actualizar contraseña y limpiar código
    const updatedMetadata = {
      ...(user.user_metadata || {}),
      recovery_code: null,
      recovery_expires: null
    };

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: nuevaPassword,
      user_metadata: updatedMetadata
    });

    if (updateErr) {
      console.error('Error actualizando contraseña:', updateErr);
      return { success: false, error: updateErr.message || 'Error al actualizar la contraseña.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error en verificarCodigoYCambiarPassword:', err);
    return { success: false, error: err.message || 'Error al cambiar la contraseña.' };
  }
}
