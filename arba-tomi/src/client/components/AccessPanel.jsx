import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, ClipboardList, FilePlus2, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';

const input = 'form-input';
const primary = 'button-primary';
const secondary = 'button-secondary';
const blank = { tipo_titular: 'persona_humana', cuit: '', apellido_nombres: '', razon_social: '', nombre_fantasia: '', forma_juridica: '', representante_legal: '', dato_registral: '', actividad: '', fecha_inicio: '', jurisdicciones: 'Buenos Aires', domicilio_fiscal: '', email_contacto: '', telefono: '' };
const titleOf = (item) => item.razon_social || item.apellido_nombres || 'Sujeto sin nombre';
const statusLabel = { borrador: 'Borrador', pendiente_revision: 'En revisión', observado: 'Observado', aprobado: 'Aprobado', activo: 'Activo', inactivo: 'Inactivo' };

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</div>;
}

function Metric({ label, value, hint, color = 'blue' }) {
  return <div className="metric-card"><div className="flex items-start justify-between"><p className="metric-label">{label}</p><span className={`metric-dot metric-dot-${color}`} /></div><p className="metric-value">{value}</p><p className="metric-hint">{hint}</p></div>;
}

export function LoginPanel({ onLogin, error }) {
  return <main className="login-stage"><form onSubmit={onLogin} className="login-card">
    <div className="brand-mark mb-6"><ShieldCheck className="h-5 w-5" /></div>
    <p className="page-eyebrow">Bienvenido</p><h1 className="mb-2 text-2xl font-bold text-white">Ingresá a tu cuenta</h1><p className="mb-7 text-sm leading-6 text-slate-400">Accedé al panel para gestionar sujetos y consultas.</p>
    <label className="field-label" htmlFor="login-email">Correo electrónico</label><input id="login-email" name="email" type="email" autoComplete="username" required placeholder="nombre@correo.com" className={`${input} mb-4`} />
    <label className="field-label" htmlFor="login-password">Contraseña</label><input id="login-password" name="password" type="password" autoComplete="current-password" required placeholder="Ingresá tu contraseña" className={input} />
    {error && <p role="alert" className="form-error mt-4">{error}</p>}<button className={`${primary} mt-6 w-full`}>Iniciar sesión</button>
    <div className="mt-5 grid gap-1 rounded-lg p-3 text-sm" style={{ border: '1px dashed #AF9B63', background: '#FBF8F0', color: '#14214F' }} aria-label="Datos de prueba"><strong>Usuario de prueba (ayuda memoria)</strong><span>Correo: <code className="font-bold">demo.arba.i26@gmail.com</code></span><span>Contraseña: <code className="font-bold">ArbaDemo2026</code></span></div>
    <p className="mt-6 text-center text-xs text-slate-500">Entorno académico · Información de ejemplo</p>
  </form></main>;
}

export function AccessPanel({ user, api, onDataChanged, view = 'altas' }) {
  const admin = user.rol === 'admin';
  const [subjects, setSubjects] = useState([]); const [users, setUsers] = useState([]); const [auditItems, setAuditItems] = useState([]);
  const [form, setForm] = useState(blank); const [editingCuit, setEditingCuit] = useState(null); const [showForm, setShowForm] = useState(false);
  const [ops, setOps] = useState({}); const [step, setStep] = useState(1); const [notice, setNotice] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [userForm, setUserForm] = useState({ nombre: '', email: '', password: '', rol: 'convencional' }); const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const result = await api.subjects('GET', '/arba/sujetos');
    if (result.ok) setSubjects(result.data.items || []); else setError(result.data?.error || 'No se pudieron cargar los sujetos.');
    if (admin && view === 'usuarios') { const response = await api.users(); if (response.ok) setUsers(response.data.items || []); else setError(response.data?.error || 'No se pudieron cargar los usuarios.'); }
    if (admin && view === 'auditoria') { const response = await api.auditSubjects(); if (response.ok) setAuditItems(response.data.items || []); else setError(response.data?.error || 'No se pudo cargar la auditoría.'); }
    setLoading(false);
  }, [api, admin, view]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(blank); setEditingCuit(null); setStep(1); setShowForm(false); };
  const editSubject = (subject) => { setForm({ ...blank, ...subject, jurisdicciones: (subject.jurisdicciones || []).join(', ') }); setEditingCuit(subject.cuit); setShowForm(true); setStep(1); setNotice(null); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const saveSubject = async (event, send = false) => {
    event?.preventDefault(); setError(''); setNotice(null);
    if (step < 3 && !send) { setStep((current) => current + 1); return; }
    const payload = { ...form, cuit: form.cuit.replace(/\D/g, ''), jurisdicciones: form.jurisdicciones.split(',').map((x) => x.trim()).filter(Boolean) };
    const result = editingCuit ? await api.subjects('PUT', `/arba/sujetos/${editingCuit}`, payload) : await api.subjects('POST', '/arba/sujetos', payload);
    if (!result.ok) { setError(result.data?.error || 'No se pudo guardar el alta.'); return; }
    if (send) { const submitted = await api.subjects('POST', `/arba/sujetos/${payload.cuit}/enviar-revision`); if (!submitted.ok) { setError(submitted.data?.error || 'No se pudo enviar a revisión.'); return; } }
    setNotice({ type: 'success', text: send ? 'El alta se envió a revisión.' : editingCuit ? 'Los cambios se guardaron.' : 'El borrador se guardó.' }); resetForm(); await load(); onDataChanged?.();
  };
  const runSubjectAction = async (path, method = 'POST', body) => { setError(''); const result = await api.subjects(method, path, body); if (!result.ok) setError(result.data?.error || 'No se pudo completar la acción.'); else { setNotice({ type: 'success', text: 'El cambio se guardó correctamente.' }); await load(); onDataChanged?.(); } };
  const createUser = async (event) => { event.preventDefault(); setError(''); const result = await api.users('POST', '/arba/usuarios', userForm); if (!result.ok) setError(result.data?.error || 'No se pudo crear el usuario.'); else { setUserForm({ nombre: '', email: '', password: '', rol: 'convencional' }); setNotice({ type: 'success', text: 'El usuario se creó correctamente.' }); await load(); } };
  const editUser = async (item) => { const nombre = window.prompt('Nombre del usuario', item.nombre); if (nombre === null) return; const email = window.prompt('Correo electrónico', item.email); if (email === null) return; const rol = window.prompt('Rol: admin o convencional', item.rol); if (rol === null) return; const result = await api.users('PUT', `/arba/usuarios/${item.id}`, { nombre, email, rol }); if (!result.ok) setError(result.data?.error || 'No se pudo editar el usuario.'); else await load(); };
  const openForm = () => { resetForm(); setShowForm(true); setNotice(null); setError(''); };
  const filteredSubjects = subjects.filter((item) => `${titleOf(item)} ${item.cuit} ${item.estado_tramite}`.toLowerCase().includes(search.toLowerCase()));

  if (view === 'panel' && admin) {
    const pending = subjects.filter((item) => item.estado_tramite === 'pendiente_revision');
    const active = subjects.filter((item) => item.estado_tramite === 'activo');
    const drafts = subjects.filter((item) => item.estado_tramite === 'borrador');
    return <section className="space-y-7"><PageHeading eyebrow="Resumen" title={`Buen día, ${user.nombre?.split(' ')[0] || 'administrador'}`} description="Este es el resumen de actividad del padrón." action={<button onClick={() => onDataChanged?.()} className={secondary}><RefreshCw className="h-4 w-4"/>Actualizar</button>}/>
      {notice && <Notice notice={notice} />}{error && <Notice notice={{ type: 'error', text: error }} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Sujetos registrados" value={subjects.length} hint="En el padrón"/><Metric label="Pendientes de revisión" value={pending.length} hint="Requieren atención" color="amber"/><Metric label="Sujetos activos" value={active.length} hint="Habilitados para operar" color="green"/><Metric label="Borradores" value={drafts.length} hint="En preparación" color="purple"/></div>
      <div className="content-card"><div className="card-heading"><div><h2>Altas pendientes</h2><p>Registros enviados para revisión</p></div><button onClick={async () => { await load(); onDataChanged?.(); }} className="text-sm font-medium text-sky-300 hover:text-sky-200">Actualizar lista</button></div>
        {pending.length ? <SubjectRows items={pending.slice(0, 5)} admin={admin} onEdit={editSubject} onAction={runSubjectAction} ops={ops} setOps={setOps}/> : <EmptyState icon={ClipboardList} title="No hay altas pendientes" description="Cuando se envíe un registro a revisión, aparecerá en esta lista."/>}
      </div>
    </section>;
  }

  if (view === 'usuarios' && admin) return <section className="space-y-6"><PageHeading eyebrow="Administración" title="Usuarios" description="Creá y administrá las cuentas que acceden al panel."/><div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_1.2fr]">
    <div className="content-card h-fit"><div className="card-heading"><div><h2>Agregar usuario</h2><p>Completá los datos de acceso</p></div><span className="card-icon"><Users className="h-5 w-5"/></span></div><form onSubmit={createUser} className="space-y-4"><Field label="Nombre"><input className={input} placeholder="Nombre y apellido" value={userForm.nombre} onChange={(e) => setUserForm({ ...userForm, nombre: e.target.value })} required/></Field><Field label="Correo electrónico"><input className={input} type="email" placeholder="nombre@correo.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required/></Field><Field label="Contraseña"><input className={input} type="password" minLength="10" placeholder="Mínimo 10 caracteres" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required/></Field><Field label="Rol"><select className={input} value={userForm.rol} onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })}><option value="convencional">Convencional</option><option value="admin">Administrador</option></select></Field><button className={primary}>Crear usuario</button></form></div>
    <div className="content-card"><div className="card-heading"><div><h2>Usuarios del panel</h2><p>{users.length} cuentas registradas</p></div></div><div className="divide-y divide-slate-800">{users.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="flex min-w-0 items-center gap-3"><div className="user-avatar">{item.nombre?.[0]?.toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-white">{item.nombre}</p><p className="truncate text-sm text-slate-400">{item.email}</p></div></div><div className="flex items-center gap-2"><span className={`status-pill ${item.activo ? 'status-green' : 'status-gray'}`}>{item.activo ? 'Activo' : 'Inactivo'}</span><span className="text-xs capitalize text-slate-400">{item.rol}</span><button className={secondary} onClick={() => editUser(item)}>Editar</button><button className={secondary} onClick={async () => { const result = await api.users('PATCH', `/arba/usuarios/${item.id}/estado`, { activo: !item.activo }); if (!result.ok) setError(result.data?.error || 'No se pudo actualizar el usuario.'); else await load(); }}>{item.activo ? 'Desactivar' : 'Activar'}</button></div></div>)}{!users.length && <EmptyState icon={Users} title="Todavía no hay usuarios" description="Creá una cuenta para dar acceso al panel."/>}</div></div>
  </div>{error && <Notice notice={{ type: 'error', text: error }}/>}</section>;

  if (view === 'auditoria' && admin) return <section className="space-y-6"><PageHeading eyebrow="Administración" title="Auditoría" description="Historial de acciones realizadas sobre los sujetos del padrón." action={<button onClick={load} className={secondary}><RefreshCw className="h-4 w-4"/>Actualizar</button>}/>{error && <Notice notice={{ type: 'error', text: error }}/>}<div className="content-card"><div className="divide-y divide-slate-800">{auditItems.map((item, index) => <div key={item.id || index} className="grid gap-2 py-4 sm:grid-cols-[1fr_2fr_1fr]"><div><p className="font-medium text-white">{item.accion?.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.fecha).toLocaleString('es-AR')}</p></div><p className="text-sm text-slate-300">{item.tipo_sujeto?.replaceAll('_', ' ') || 'Sujeto'} · CUIT {item.sujeto_cuit || '—'}</p><p className="text-sm text-slate-400">{statusLabel[item.estado_anterior] || '—'} <span className="text-slate-600">→</span> {statusLabel[item.estado_posterior] || '—'}</p></div>)}{!auditItems.length && <EmptyState icon={ClipboardList} title="Sin movimientos registrados" description="Las acciones de revisión y actualización aparecerán aquí."/>}</div></div></section>;

  const headingTitle = admin ? 'Gestión de sujetos' : 'Mis altas';
  const headingDesc = admin ? 'Revisá, administrá y actualizá los sujetos del padrón.' : 'Creá un alta y consultá el estado de tus registros.';
  const showSubjectList = admin || !showForm;

  return <section className="space-y-6">
    <PageHeading eyebrow={admin ? 'Padrón' : 'Trámites'} title={showForm ? (editingCuit ? 'Editar sujeto' : 'Nueva alta') : headingTitle} description={showForm ? 'Completá los datos en tres pasos.' : headingDesc} action={!showForm && <button onClick={openForm} className={primary}><FilePlus2 className="h-4 w-4"/>{admin ? 'Nuevo sujeto' : 'Crear alta'}</button>}/>
    {notice && <Notice notice={notice} />}{error && <Notice notice={{ type: 'error', text: error }} />}
    {showForm && <SubjectForm form={form} setForm={setForm} step={step} setStep={setStep} editingCuit={editingCuit} onSubmit={saveSubject} onCancel={resetForm} admin={admin}/>}
    {showSubjectList && <div className="content-card"><div className="card-heading"><div><h2>{admin ? 'Sujetos del padrón' : 'Mis registros'}</h2><p>{subjects.length} {subjects.length === 1 ? 'registro' : 'registros'}</p></div><label className="search-box"><Search className="h-4 w-4"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o CUIT"/></label></div>
      {loading ? <div className="p-10 text-center text-sm text-slate-400">Cargando registros…</div> : filteredSubjects.length ? <SubjectRows items={filteredSubjects} admin={admin} user={user} onEdit={editSubject} onAction={runSubjectAction} ops={ops} setOps={setOps}/> : <EmptyState icon={FilePlus2} title={subjects.length ? 'No encontramos resultados' : 'Todavía no hay registros'} description={subjects.length ? 'Probá con otro nombre, CUIT o estado.' : 'Cuando crees un alta, aparecerá en esta lista.'} action={!subjects.length && <button onClick={openForm} className={primary}>Crear primera alta</button>}/>}
    </div>}
  </section>;
}

function SubjectForm({ form, setForm, step, setStep, editingCuit, onSubmit, onCancel, admin }) {
  const steps = ['Identificación', 'Actividad y alcance', 'Revisión'];
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <form onSubmit={(event) => onSubmit(event, false)} className="content-card space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white">{editingCuit ? 'Actualización de datos' : 'Alta de sujeto'}</p><p className="mt-1 text-xs text-slate-400">Paso {step} de 3 · {steps[step - 1]}</p></div><div className="flex gap-2">{steps.map((label, index) => <span key={label} className={`step-dot ${index + 1 <= step ? 'step-dot-active' : ''}`} title={label}>{index + 1 < step ? <Check className="h-3.5 w-3.5"/> : index + 1}</span>)}</div></div>
    {step === 1 && <div className="grid gap-4 md:grid-cols-2"><Field label="Tipo de persona"><select className={input} value={form.tipo_titular} onChange={(e) => update('tipo_titular', e.target.value)}><option value="persona_humana">Persona humana</option><option value="persona_juridica">Persona jurídica</option></select></Field><Field label="CUIT"><input className={input} inputMode="numeric" maxLength="13" value={form.cuit} onChange={(e) => update('cuit', e.target.value)} placeholder="00-00000000-0" required/></Field>{form.tipo_titular === 'persona_humana' ? <Field label="Apellido y nombres"><input className={input} value={form.apellido_nombres} onChange={(e) => update('apellido_nombres', e.target.value)} placeholder="Nombre completo" required/></Field> : <><Field label="Denominación legal"><input className={input} value={form.razon_social} onChange={(e) => update('razon_social', e.target.value)} placeholder="Nombre legal" required/></Field><Field label="Forma jurídica"><select className={input} value={form.forma_juridica} onChange={(e) => update('forma_juridica', e.target.value)}><option value="">Seleccionar (opcional)</option>{['SA', 'SRL', 'SAS', 'Otra'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Representante legal"><input className={input} value={form.representante_legal} onChange={(e) => update('representante_legal', e.target.value)} placeholder="Opcional"/></Field><Field label="Dato registral"><input className={input} value={form.dato_registral} onChange={(e) => update('dato_registral', e.target.value)} placeholder="Opcional"/></Field></>}<Field label="Nombre de fantasía"><input className={input} value={form.nombre_fantasia} onChange={(e) => update('nombre_fantasia', e.target.value)} placeholder="Opcional"/></Field></div>}
    {step === 2 && <div className="grid gap-4 md:grid-cols-2"><Field label="Actividad principal"><input className={input} value={form.actividad} onChange={(e) => update('actividad', e.target.value)} placeholder="Descripción de la actividad" required/></Field><Field label="Fecha de inicio"><input className={input} type="date" value={form.fecha_inicio} onChange={(e) => update('fecha_inicio', e.target.value)}/></Field><Field label="Jurisdicciones"><input className={input} value={form.jurisdicciones} onChange={(e) => update('jurisdicciones', e.target.value)} placeholder="Separá cada jurisdicción con coma"/></Field><Field label="Domicilio fiscal"><input className={input} value={form.domicilio_fiscal} onChange={(e) => update('domicilio_fiscal', e.target.value)} placeholder="Calle, número, localidad"/></Field><Field label="Correo de contacto"><input className={input} type="email" value={form.email_contacto} onChange={(e) => update('email_contacto', e.target.value)} placeholder="Opcional"/></Field><Field label="Teléfono"><input className={input} value={form.telefono} onChange={(e) => update('telefono', e.target.value)} placeholder="Opcional"/></Field></div>}
    {step === 3 && <div className="space-y-5"><div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-5 sm:grid-cols-2"><ReviewItem label="Tipo de persona" value={form.tipo_titular === 'persona_humana' ? 'Persona humana' : 'Persona jurídica'}/><ReviewItem label="CUIT" value={form.cuit}/><ReviewItem label="Nombre legal" value={form.tipo_titular === 'persona_humana' ? form.apellido_nombres : form.razon_social}/>{form.nombre_fantasia && <ReviewItem label="Nombre de fantasía" value={form.nombre_fantasia}/>}<ReviewItem label="Actividad principal" value={form.actividad}/><ReviewItem label="Fecha de inicio" value={form.fecha_inicio || 'Sin informar'}/><ReviewItem label="Jurisdicciones" value={form.jurisdicciones || 'Sin informar'}/><ReviewItem label="Domicilio fiscal" value={form.domicilio_fiscal || 'Sin informar'}/>{form.tipo_titular === 'persona_juridica' && <ReviewItem label="Representante legal" value={form.representante_legal || 'Sin informar'}/>}</div><div className="notice-info"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/><p>Los datos fiscales quedan pendientes de consulta. El alta no constituye una inscripción oficial ni habilita aplicaciones fiscales o alícuotas.</p></div></div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5"><div className="flex gap-2">{step > 1 && <button type="button" onClick={() => setStep((current) => current - 1)} className={secondary}><ArrowLeft className="h-4 w-4"/>Anterior</button>}<button type="button" onClick={onCancel} className={secondary}>Cancelar</button></div><div className="flex gap-2">{step < 3 ? <button className={primary}>Continuar<ArrowRight className="h-4 w-4"/></button> : <><button type="button" onClick={(event) => onSubmit(event, false)} className={secondary}>Guardar borrador</button>{!admin && <button type="button" onClick={(event) => onSubmit(event, true)} className={primary}>Enviar a revisión</button>}</>}</div></div>
  </form>;
}

function SubjectRows({ items, admin, user, onEdit, onAction, ops, setOps }) {
  return <div className="divide-y divide-slate-800">{items.map((item) => {
    const canEdit = admin || (item.creado_por === user?.id && ['borrador', 'pendiente_revision'].includes(item.estado_tramite));
    const status = item.estado_tramite || 'borrador';
    const updateOps = (changes) => setOps((current) => ({ ...current, [item.cuit]: { ...current[item.cuit], ...changes } }));
    return <article key={item.cuit} className="subject-row"><div className="flex min-w-0 items-start gap-3"><div className="subject-avatar">{titleOf(item)[0]?.toUpperCase()}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-white">{titleOf(item)}</h3><span className={`status-pill status-${status}`}>{statusLabel[status] || status}</span></div><p className="mt-1 text-sm text-slate-400">CUIT {item.cuit} · {item.tipo_titular === 'persona_humana' ? 'Persona humana' : 'Persona jurídica'}</p><p className="mt-1 text-xs text-slate-500">{item.actividad || 'Actividad sin informar'} · Fiscal: {item.estado_fiscal === 'pendiente_consulta' ? 'pendiente de consulta' : item.estado_fiscal || 'sin verificar'}</p></div></div>
      <div className="flex flex-wrap items-center gap-2">{canEdit && <button className={secondary} onClick={() => onEdit(item)}>Editar</button>}{admin && status === 'pendiente_revision' && <><button className={primary} onClick={() => onAction(`/arba/sujetos/${item.cuit}/aprobar`)}>Aprobar</button><button className={secondary} onClick={() => onAction(`/arba/sujetos/${item.cuit}/observar`)}>Observar</button></>}{admin && status === 'aprobado' && <div className="ops-controls"><label>Alícuota<input type="number" min="0" max="1" step="0.001" value={ops[item.cuit]?.alicuota ?? '0.03'} onChange={(e) => updateOps({ alicuota: e.target.value })}/></label><label><input type="checkbox" checked={ops[item.cuit]?.arba ?? true} onChange={(e) => updateOps({ arba: e.target.checked })}/> ARBA IIBB</label><label><input type="checkbox" checked={ops[item.cuit]?.arca ?? false} onChange={(e) => updateOps({ arca: e.target.checked })}/> ARCA</label><button className={primary} onClick={() => onAction(`/arba/sujetos/${item.cuit}/estado-operativo`, 'PATCH', { estado: 'activo', alicuota: Number(ops[item.cuit]?.alicuota ?? 0.03), aplicaciones: { arba_iibb: Boolean(ops[item.cuit]?.arba ?? true), arca_facturacion: Boolean(ops[item.cuit]?.arca) } })}>Activar</button></div>}{admin && status === 'activo' && <button className="button-danger" onClick={() => onAction(`/arba/sujetos/${item.cuit}/estado-operativo`, 'PATCH', { estado: 'inactivo', alicuota: Number(item.alicuota ?? 0), aplicaciones: item.aplicaciones || { arba_iibb: false, arca_facturacion: false } })}>Desactivar</button>}</div>
    </article>;
  })}</div>;
}

function Field({ label, children }) { return <label className="block"><span className="field-label">{label}</span>{children}</label>; }
function ReviewItem({ label, value }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-200">{value || 'Sin informar'}</p></div>; }
function Notice({ notice }) { return <div role="status" className={notice.type === 'error' ? 'notice-error' : 'notice-success'}>{notice.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0"/> : <Check className="h-4 w-4 shrink-0"/>}<span>{notice.text}</span></div>; }
function EmptyState({ icon: Icon, title, description, action }) { return <div className="empty-state"><span className="card-icon"><Icon className="h-5 w-5"/></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
