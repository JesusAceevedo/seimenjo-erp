'use server';

import nodemailer from 'nodemailer';
import { headers } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { checkRateLimit, resetRateLimit } from '../../../lib/utils/rateLimit';

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return h.get('x-real-ip') || 'unknown';
  } catch {
    return 'unknown';
  }
}

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
 * 1. Genera un código de 8 caracteres alfanuméricos y lo envía al correo del usuario.
 * Protegido con Rate Limiting por IP y correo.
 */
export async function solicitarCodigoRecuperacion(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Por favor ingresa un correo electrónico válido.' };
    }

    const ip = await getClientIp();

    // 1. Rate limiting por IP: máx 10 solicitudes cada 15 min
    const ipLimit = checkRateLimit(`pw_req_ip_${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10
    });
    if (!ipLimit.allowed) {
      return { success: false, error: ipLimit.message || 'Demasiadas solicitudes desde esta conexión. Espera unos minutos.' };
    }

    // 2. Rate limiting por Email: máx 3 solicitudes cada 15 min con 60s mínimo de cooldown
    const emailLimit = checkRateLimit(`pw_req_email_${cleanEmail}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 3,
      minIntervalMs: 60 * 1000
    });
    if (!emailLimit.allowed) {
      return { success: false, error: emailLimit.message || 'Has solicitado varios códigos recientemente. Espera unos momentos.' };
    }

    // 3. Buscar usuario en Auth
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return {
        success: false,
        error: 'No se encontró ninguna cuenta registrada con este correo electrónico.'
      };
    }

    // 4. Generar código alfanumérico de 8 caracteres (alta entropía)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    // 5. Guardar en user_metadata del usuario con contador de intentos inicializado a 0
    const updatedMetadata = {
      ...(user.user_metadata || {}),
      recovery_code: code,
      recovery_expires: expiresAt,
      recovery_attempts: 0
    };

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: updatedMetadata
    });

    if (updateErr) {
      console.error('Error guardando código de recuperación:', updateErr);
      return { success: false, error: 'Error al generar el código de seguridad. Intenta nuevamente.' };
    }

    // 6. Enviar correo electrónico con el código
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
 * 2. Valida el código de recuperación y actualiza la contraseña en Supabase Auth.
 * Incluye protección contra fuerza bruta (máximo 5 intentos) y casteo seguro de expiración.
 */
export async function verificarCodigoYCambiarPassword(
  email: string,
  codigo: string,
  nuevaPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (codigo || '').trim().toUpperCase();

    if (!cleanEmail || !cleanCode) {
      return { success: false, error: 'Por favor completa todos los campos requeridos.' };
    }

    const ip = await getClientIp();

    // Rate limiting por IP para verificar contraseñas (máx 15 intentos en 15 min)
    const ipVerifyLimit = checkRateLimit(`pw_ver_ip_${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 15
    });
    if (!ipVerifyLimit.allowed) {
      return { success: false, error: ipVerifyLimit.message || 'Demasiados intentos desde esta IP. Intenta más tarde.' };
    }

    if (!nuevaPassword || nuevaPassword.length < 8) {
      return { 
        success: false, 
        error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, números o símbolos.' 
      };
    }
    // Verificar fortaleza básica
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/;
    if (!strongRegex.test(nuevaPassword)) {
      return {
        success: false,
        error: 'La contraseña debe contener mayúsculas, minúsculas y números.'
      };
    }

    // 1. Buscar usuario
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    const currentAttempts = Number(user.user_metadata?.recovery_attempts || 0);
    if (currentAttempts >= 5) {
      // Invalida el código para mitigar ataques de fuerza bruta
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          recovery_code: null,
          recovery_expires: null,
          recovery_attempts: 0
        }
      });
      return {
        success: false,
        error: 'Has superado el límite de 5 intentos fallidos. Por seguridad, el código ha sido cancelado. Solicita un código nuevo.'
      };
    }

    const savedCode = user.user_metadata?.recovery_code;
    const expiresAt = user.user_metadata?.recovery_expires;

    if (!savedCode || !expiresAt) {
      return {
        success: false,
        error: 'No hay un código de recuperación activo para esta cuenta. Solicita uno nuevo.'
      };
    }

    // Casteo y verificación de expiración segura
    const expNumber = typeof expiresAt === 'number' ? expiresAt : Number(expiresAt);
    if (isNaN(expNumber) || Date.now() > expNumber) {
      return {
        success: false,
        error: 'El código de seguridad ha expirado. Por favor solicita uno nuevo.'
      };
    }

    if (savedCode.toString().trim().toUpperCase() !== cleanCode) {
      const nextAttempts = currentAttempts + 1;
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          recovery_attempts: nextAttempts
        }
      });
      const remaining = 5 - nextAttempts;
      return {
        success: false,
        error: remaining > 0
          ? `El código de verificación ingresado es incorrecto. Te quedan ${remaining} intento(s).`
          : 'Código incorrecto. Has superado el límite máximo de intentos.'
      };
    }

    // 2. Actualizar contraseña y limpiar código
    const updatedMetadata = {
      ...(user.user_metadata || {}),
      recovery_code: null,
      recovery_expires: null,
      recovery_attempts: 0
    };

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: nuevaPassword,
      user_metadata: updatedMetadata
    });

    if (updateErr) {
      console.error('Error actualizando contraseña:', updateErr);
      return { success: false, error: updateErr.message || 'Error al actualizar la contraseña.' };
    }

    // Limpiar rate limit tras éxito
    resetRateLimit(`pw_req_email_${cleanEmail}`);
    resetRateLimit(`pw_ver_ip_${ip}`);

    return { success: true };
  } catch (err: any) {
    console.error('Error en verificarCodigoYCambiarPassword:', err);
    return { success: false, error: err.message || 'Error al cambiar la contraseña.' };
  }
}
