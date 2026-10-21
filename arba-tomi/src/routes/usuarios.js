const express = require('express');
const { authRequired, adminRequired, hashPassword } = require('./auth');
const router = express.Router();
const auditRouter = express.Router();
const stamp = () => new Date().toISOString();
router.use(authRequired, adminRequired);
router.get('/', (req,res)=>res.json({items:req.app.locals.db.prepare('SELECT id,nombre,email,rol,activo,creado_en,actualizado_en FROM usuarios ORDER BY nombre').all().map(x=>({...x,activo:Boolean(x.activo)}))}));
router.post('/', (req,res)=>{
  const {nombre,email,password,rol}=req.body||{};
  if(typeof nombre!=='string'||!nombre.trim()||typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<10||!['admin','convencional'].includes(rol))return res.status(400).json({error:'datos de usuario invalidos; contraseña mínima de 10 caracteres'});
  const now=stamp();try{const info=req.app.locals.db.prepare('INSERT INTO usuarios(nombre,email,password_hash,rol,activo,creado_en,actualizado_en) VALUES(?,?,?,?,1,?,?)').run(nombre.trim(),email.trim().toLowerCase(),hashPassword(password),rol,now,now);return res.status(201).json({id:info.lastInsertRowid,nombre:nombre.trim(),email:email.trim().toLowerCase(),rol,activo:true});}catch(e){if(e.code?.startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'email ya registrado'});throw e;}
});
router.put('/:id',(req,res)=>{
  const {nombre,email,password,rol}=req.body||{};if(typeof nombre!=='string'||!nombre.trim()||typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','convencional'].includes(rol)||(password!==undefined&&(typeof password!=='string'||password.length<10)))return res.status(400).json({error:'datos de usuario invalidos'});
  const db=req.app.locals.db;try{const result=password?db.prepare('UPDATE usuarios SET nombre=?,email=?,rol=?,password_hash=?,actualizado_en=? WHERE id=?').run(nombre.trim(),email.trim().toLowerCase(),rol,hashPassword(password),stamp(),req.params.id):db.prepare('UPDATE usuarios SET nombre=?,email=?,rol=?,actualizado_en=? WHERE id=?').run(nombre.trim(),email.trim().toLowerCase(),rol,stamp(),req.params.id);if(!result.changes)return res.status(404).json({error:'usuario no encontrado'});return res.json({id:Number(req.params.id),nombre:nombre.trim(),email:email.trim().toLowerCase(),rol});}catch(e){if(e.code?.startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'email ya registrado'});throw e;}
});
router.patch('/:id/estado',(req,res)=>{if(typeof req.body?.activo!=='boolean')return res.status(400).json({error:'estado invalido'});if(Number(req.params.id)===req.user.id&&!req.body.activo)return res.status(409).json({error:'no se puede desactivar la propia cuenta'});const result=req.app.locals.db.prepare('UPDATE usuarios SET activo=?,actualizado_en=? WHERE id=?').run(Number(req.body.activo),stamp(),req.params.id);if(!result.changes)return res.status(404).json({error:'usuario no encontrado'});return res.json({id:Number(req.params.id),activo:req.body.activo});});
auditRouter.use(authRequired,adminRequired);
auditRouter.get('/',(req,res)=>{const items=req.app.locals.db.prepare('SELECT * FROM auditoria_sujetos ORDER BY id DESC LIMIT 500').all().map(({detalle_json,...x})=>({...x,detalle:(()=>{try{return JSON.parse(detalle_json||'{}')}catch{return {}}})()}));return res.json({items});});
module.exports={router,auditRouter};
