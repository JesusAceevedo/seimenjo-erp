'use server';

import { createClient } from '@supabase/supabase-js';
import { verifyStaffUser } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Crear un cliente con service role para tareas administrativas bypass de RLS y Auth limits
const getAdminClient = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variables de entorno de Supabase Admin (URL/Service Role Key) no configuradas.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function crearUsuarioStaffAdmin(params: {
  email: string;
  passwordTemporal: string;
  nombre: string;
  empresaId: string;
  perfilId: string;
  sucursalesPermitidas: string[];
  empresasPermitidas?: string[];
}, token: string) {
  const caller = await verifyStaffUser(token);
  if (!caller.esSuperusuario && caller.empresaId !== params.empresaId) {
    throw new Error('Acceso denegado: No tienes permisos para crear usuarios en esta empresa.');
  }
  const supabaseAdmin = getAdminClient();

  try {
    // 1. Crear el usuario en Supabase Auth administrativamente
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: params.email,
      password: params.passwordTemporal,
      email_confirm: true,
      user_metadata: {
        nombre: params.nombre,
        tipo_usuario: 'staff',
        empresa_id: params.empresaId,
        perfil_id: params.perfilId
      }
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error('No se pudo crear el usuario en Auth.');

    const userId = authUser.user.id;

    // 2. Insertar/hacer upsert del usuario en la tabla public.usuarios_staff
    const { error: dbError } = await supabaseAdmin
      .from('usuarios_staff')
      .upsert({
        id: userId, // ID subrogado
        supabase_auth_id: userId,
        correo: params.email,
        activo: true,
        rol_id: 1, // Rol staff
        empresa_id: params.empresaId,
        perfil_id: params.perfilId,
        sucursales_permitidas: params.sucursalesPermitidas
      }, { onConflict: 'supabase_auth_id' });

    if (dbError) {
      // Si falla la inserción en la base de datos, revertimos la creación del usuario en Auth
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw dbError;
    }

    // 3. Registrar los permisos multisuccursales en la tabla pivot sucursales_usuario_pivot
    if (params.sucursalesPermitidas && params.sucursalesPermitidas.length > 0) {
      const pivots = params.sucursalesPermitidas.map((sucId) => ({
        usuario_id: userId,
        sucursal_id: sucId
      }));

      const { error: pivotError } = await supabaseAdmin
        .from('sucursales_usuario_pivot')
        .insert(pivots);

      if (pivotError) {
        // En caso de error, limpiar el perfil y el usuario
        await supabaseAdmin.from('usuarios_staff').delete().eq('supabase_auth_id', userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw pivotError;
      }
    }

    // 4. Registrar los permisos multiempresa en la tabla pivot empresas_usuario_pivot
    const empresasAInsertar = params.empresasPermitidas && params.empresasPermitidas.length > 0
      ? params.empresasPermitidas
      : [params.empresaId];

    const empresasPivots = empresasAInsertar.map((empId) => ({
      usuario_id: userId,
      empresa_id: empId
    }));

    const { error: empPivotError } = await supabaseAdmin
      .from('empresas_usuario_pivot')
      .insert(empresasPivots);

    if (empPivotError) {
      // En caso de error, limpiar todo lo anterior
      await supabaseAdmin.from('sucursales_usuario_pivot').delete().eq('usuario_id', userId);
      await supabaseAdmin.from('usuarios_staff').delete().eq('supabase_auth_id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw empPivotError;
    }

    return { success: true, userId };
  } catch (err: any) {
    console.error('Error en crearUsuarioStaffAdmin:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

export async function habilitarPortalClienteAdmin(params: {
  email: string;
  passwordTemporal: string;
  clienteId: string;
  nombreCliente: string;
}, token: string) {
  const caller = await verifyStaffUser(token);
  const supabaseAdmin = getAdminClient();

  if (!caller.esSuperusuario) {
    // Verificar que el cliente pertenece a la misma empresa que el caller
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clientes')
      .select('empresa_id')
      .eq('id', params.clienteId)
      .single();

    if (clientErr || !client || client.empresa_id !== caller.empresaId) {
      throw new Error('Acceso denegado: El cliente no pertenece a tu empresa.');
    }
  }

  try {
    // 1. Crear el usuario en Supabase Auth administrativamente con metadatos del cliente
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: params.email,
      password: params.passwordTemporal,
      email_confirm: true,
      user_metadata: {
        nombre: params.nombreCliente,
        tipo_usuario: 'cliente',
        cliente_id: params.clienteId
      }
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error('No se pudo crear el usuario en Auth.');

    const userId = authUser.user.id;

    // 2. Actualizar el registro del cliente en la base de datos para enlazar el correo y activar el portal
    const { error: updateError } = await supabaseAdmin
      .from('clientes')
      .update({
        email_facturacion: params.email, // Garantizar que coincida con el correo del portal
        es_anonimo: false
      })
      .eq('id', params.clienteId);

    if (updateError) {
      // Si falla, limpiar el usuario Auth creado
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw updateError;
    }

    return { success: true, userId };
  } catch (err: any) {
    console.error('Error en habilitarPortalClienteAdmin:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

export async function crearBucketsAlmacenamiento(token: string) {
  const caller = await verifyStaffUser(token);
  if (!caller.esSuperusuario) {
    throw new Error('Acceso denegado: Solo los superusuarios pueden crear buckets de almacenamiento.');
  }
  const supabaseAdmin = getAdminClient();
  try {
    // 1. Crear bucket público para logos de empresas
    const { error: errorLogos } = await supabaseAdmin.storage.createBucket('empresas-logos', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
      fileSizeLimit: 2097152 // 2MB
    });

    if (errorLogos && !errorLogos.message.toLowerCase().includes('already exists')) {
      console.warn("Advertencia al crear bucket empresas-logos:", errorLogos.message);
    }

    // 2. Crear bucket privado para certificados CSD (empresas-csd)
    const { error: errorCSD } = await supabaseAdmin.storage.createBucket('empresas-csd', {
      public: false,
      allowedMimeTypes: ['application/octet-stream', 'application/x-x509-ca-cert', 'application/pkcs8', 'application/x-pkcs12'],
      fileSizeLimit: 1048576 // 1MB
    });

    if (errorCSD && !errorCSD.message.toLowerCase().includes('already exists')) {
      console.warn("Advertencia al crear bucket empresas-csd:", errorCSD.message);
    }

    // 3. Crear bucket privado para certificados CSD (csd-private)
    const { error: errorCSDPrivate } = await supabaseAdmin.storage.createBucket('csd-private', {
      public: false,
      allowedMimeTypes: ['application/octet-stream', 'application/x-x509-ca-cert', 'application/pkcs8', 'application/x-pkcs12'],
      fileSizeLimit: 1048576 // 1MB
    });

    if (errorCSDPrivate && !errorCSDPrivate.message.toLowerCase().includes('already exists')) {
      console.warn("Advertencia al crear bucket csd-private:", errorCSDPrivate.message);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error en crearBucketsAlmacenamiento:", err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

export async function inicializarNuevaEmpresa(params: {
  empresaId: string;
  nombre: string;
  razon_social: string;
  rfc: string;
  codigo_postal: string;
  regimen_fiscal_id: string;
  email_contacto: string;
  telefono: string;
  moneda: string;
  logo_url: string;
  logo_ticket_url: string;
  csd_cer_url: string;
  csd_key_url: string;
  csd_password_encriptada: string;
  modulos: string[];
}, token: string) {
  const caller = await verifyStaffUser(token);
  if (!caller.esSuperusuario && caller.empresaId !== params.empresaId) {
    throw new Error('Acceso denegado: No puedes inicializar otra empresa.');
  }
  const supabaseAdmin = getAdminClient();
  try {
    const { error: updateError } = await supabaseAdmin
      .from('empresas')
      .update({
        nombre: params.nombre,
        razon_social: params.razon_social,
        rfc: params.rfc.toUpperCase(),
        codigo_postal: params.codigo_postal,
        regimen_fiscal_id: params.regimen_fiscal_id,
        email_contacto: params.email_contacto,
        telefono: params.telefono,
        moneda: params.moneda,
        logo_url: params.logo_url,
        logo_ticket_url: params.logo_ticket_url,
        csd_cer_url: params.csd_cer_url,
        csd_key_url: params.csd_key_url,
        csd_password_encriptada: params.csd_password_encriptada,
        facturacion_activa: true
      })
      .eq('id', params.empresaId);

    if (updateError) throw updateError;

    // 2. Insertar masivamente los módulos seleccionados
    if (params.modulos && params.modulos.length > 0) {
      // Limpiar módulos anteriores en caso de que existan
      await supabaseAdmin.from('modulos_empresa').delete().eq('empresa_id', params.empresaId);

      const modulosPayload = params.modulos.map(mod => ({
        empresa_id: params.empresaId,
        modulo: mod
      }));

      const { error: modError } = await supabaseAdmin
        .from('modulos_empresa')
        .insert(modulosPayload);

      if (modError) throw modError;
    }

    // 3. Inicializar configuración del ticket
    const encabezadoDefault = `${params.nombre.toUpperCase()} S.A. DE C.V.\nRFC: ${params.rfc.toUpperCase()}\nCP: ${params.codigo_postal}\nEmail: ${params.email_contacto}\nTel: ${params.telefono}`;
    const piePaginaDefault = `¡Gracias por su compra!\nConserve su ticket para cualquier aclaración.`;

    const { error: ticketError } = await supabaseAdmin
      .from('configuracion_ticket')
      .upsert({
        id: params.empresaId, // Asignar el ID de la empresa para relacionarlo 1:1
        encabezado: encabezadoDefault,
        pie_pagina: piePaginaDefault,
        logo_url: params.logo_url,
        promo_tipo: 'ninguno',
        opciones_visualizacion: { mostrar_telefono: true, mostrar_facturacion: true, mostrar_comentarios: true }
      });

    if (ticketError) throw ticketError;

    return { success: true };
  } catch (err: any) {
    console.error("Error en inicializarNuevaEmpresa:", err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

export async function provisionarAdminEmpresa(params: {
  empresaId: string;
  nombre: string;
  email: string;
  passwordTemporal: string;
}, token: string) {
  const caller = await verifyStaffUser(token);
  if (!caller.esSuperusuario) {
    throw new Error('Acceso denegado: Solo los superusuarios pueden provisionar administradores de empresas.');
  }
  const supabaseAdmin = getAdminClient();
  try {
    // 1. Verificar/Crear una sucursal por defecto ("Matriz") si la empresa no tiene ninguna
    const { data: sucs, error: sucsError } = await supabaseAdmin
      .from('sucursales')
      .select('id')
      .eq('empresa_id', params.empresaId);
    
    if (sucsError) throw sucsError;
    
    let sucursalId = '';
    if (!sucs || sucs.length === 0) {
      const { data: newSuc, error: newSucError } = await supabaseAdmin
        .from('sucursales')
        .insert({
          empresa_id: params.empresaId,
          nombre: 'Matriz',
          codigo: 'MAT'
        })
        .select('id')
        .single();
      if (newSucError) throw newSucError;
      sucursalId = newSuc.id;
    } else {
      sucursalId = sucs[0].id;
    }

    // 2. Verificar/Crear un perfil de seguridad por defecto ("Administrador") si la empresa no tiene ninguno
    const { data: perfs, error: perfsError } = await supabaseAdmin
      .from('perfiles_seguridad')
      .select('id')
      .eq('empresa_id', params.empresaId);
    
    if (perfsError) throw perfsError;

    let perfilId = '';
    if (!perfs || perfs.length === 0) {
      const { data: newPerf, error: newPerfError } = await supabaseAdmin
        .from('perfiles_seguridad')
        .insert({
          empresa_id: params.empresaId,
          nombre: 'Administrador',
          permisos: {
            ventas: { read: true, write: true },
            clientes: { read: true, write: true },
            gastos: { read: true, write: true },
            facturacion: { read: true, write: true },
            productos: { read: true, write: true },
            produccion: { read: true, write: true }
          }
        })
        .select('id')
        .single();
      if (newPerfError) throw newPerfError;
      perfilId = newPerf.id;
    } else {
      perfilId = perfs[0].id;
    }

    // 3. Crear el usuario staff usando la acción existente
    const res = await crearUsuarioStaffAdmin({
      email: params.email,
      passwordTemporal: params.passwordTemporal,
      nombre: params.nombre,
      empresaId: params.empresaId,
      perfilId: perfilId,
      sucursalesPermitidas: [sucursalId]
    }, token);

    return res;
  } catch (err: any) {
    console.error('Error en provisionarAdminEmpresa:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

export async function actualizarUsuarioStaffAdmin(params: {
  userId: string;
  perfilId: string;
  sucursalesPermitidas: string[];
  empresasPermitidas: string[];
}, token: string) {
  const caller = await verifyStaffUser(token);
  const supabaseAdmin = getAdminClient();

  if (!caller.esSuperusuario) {
    const { data: targetStaff } = await supabaseAdmin
      .from('usuarios_staff')
      .select('empresa_id')
      .eq('id', params.userId)
      .single();
    if (!targetStaff || targetStaff.empresa_id !== caller.empresaId) {
      throw new Error('Acceso denegado: No tienes permisos para editar a este usuario.');
    }
  }

  try {
    // 1. Actualizar el registro del usuario en la tabla public.usuarios_staff
    const { error: dbError } = await supabaseAdmin
      .from('usuarios_staff')
      .update({
        perfil_id: params.perfilId,
        sucursales_permitidas: params.sucursalesPermitidas
      })
      .eq('id', params.userId);

    if (dbError) throw dbError;

    // 2. Actualizar metadatos en Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(params.userId, {
      user_metadata: {
        perfil_id: params.perfilId
      }
    });
    if (authError) console.error("Error actualizando metadata de Auth:", authError);

    // 3. Actualizar pivotes de sucursales
    await supabaseAdmin.from('sucursales_usuario_pivot').delete().eq('usuario_id', params.userId);
    if (params.sucursalesPermitidas.length > 0) {
      const pivots = params.sucursalesPermitidas.map((sucId) => ({
        usuario_id: params.userId,
        sucursal_id: sucId
      }));
      const { error: pivotError } = await supabaseAdmin.from('sucursales_usuario_pivot').insert(pivots);
      if (pivotError) throw pivotError;
    }

    // 4. Actualizar pivotes de empresas
    await supabaseAdmin.from('empresas_usuario_pivot').delete().eq('usuario_id', params.userId);
    if (params.empresasPermitidas.length > 0) {
      const pivots = params.empresasPermitidas.map((empId) => ({
        usuario_id: params.userId,
        empresa_id: empId
      }));
      const { error: pivotError } = await supabaseAdmin.from('empresas_usuario_pivot').insert(pivots);
      if (pivotError) throw pivotError;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error en actualizarUsuarioStaffAdmin:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

