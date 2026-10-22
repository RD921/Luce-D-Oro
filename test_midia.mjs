// Biblioteca de mídia. Requer servidor em :3001 com dev@x.com / g@x.com / c@x.com (ver test_arquitetura.mjs).
import zlib from 'node:zlib';
const base = 'http://localhost:3001';
const J = { 'content-type': 'application/json' };
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const png = (w, h, cor) => { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, cor)]); const raw = Buffer.concat(Array(h).fill(row)); return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
const b64 = (b) => 'data:image/png;base64,' + b.toString('base64');
const login = async (email, password) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) })).json()).token;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('FALHOU:', m); } };
const call = async (t, method, rota, body) => { const r = await fetch(`${base}/api/admin/${rota}`, { method, headers: { ...J, Authorization: `Bearer ${t}` }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, d: await r.json().catch(() => ({})) }; };

const dev = await login('dev@x.com', 'Rodrigo_Dev_30');
const ger = await login('g@x.com', 'Gerente#12345');
const cli = await login('c@x.com', 'x');
ok((await call(cli, 'GET', 'media')).s === 403 || (await call(cli, 'GET', 'media')).s === 401, 'cliente bloqueado');
ok((await fetch(`${base}/api/admin/media`)).status === 401, 'sem login = 401');

const up = await call(dev, 'POST', 'media', { data: b64(png(4, 3, 200)), name: 'anel-teste.png', category: 'banners', alt: 'Anel' });
ok(up.s === 201, 'upload válido ' + up.s);
ok(up.d.largura === 4 && up.d.altura === 3, 'dimensões lidas');
ok(up.d.categoria === 'banners' && up.d.alt === 'Anel', 'metadados');
const id = up.d.id;
const img = await fetch(base + up.d.urlBase);
ok(img.status === 200 && img.headers.get('content-type') === 'image/png', 'arquivo servido');

ok((await call(dev, 'POST', 'media', { data: 'data:image/png;base64,' + Buffer.from('<?php echo 1; ?>').toString('base64'), name: 'x.png' })).s === 400, 'rejeita falso PNG');
ok((await call(dev, 'POST', 'media', { data: '' })).s === 400, 'rejeita vazio');
ok((await call(dev, 'POST', 'media', { data: b64(Buffer.concat([png(1, 1, 1), Buffer.alloc(9 * 1024 * 1024)])) })).s === 413, 'rejeita >8MB');

let l = await call(dev, 'GET', 'media?q=anel');
ok(l.d.total >= 1 && l.d.itens.some(i => i.id === id), 'busca por nome');
l = await call(dev, 'GET', 'media?category=home');
ok(!l.d.itens.some(i => i.id === id), 'filtro por categoria exclui');
l = await call(dev, 'GET', 'media?type=png&sort=size');
ok(l.d.itens.some(i => i.id === id), 'filtro formato');
l = await call(dev, 'GET', 'media?type=jpg');
ok(!l.d.itens.some(i => i.id === id), 'filtro jpg exclui png');

const up2 = await call(ger, 'PUT', `media/${id}`, { nome: 'anel-novo.png', alt: 'Anel prata', categoria: 'home' });
ok(up2.s === 200 && up2.d.nome === 'anel-novo.png' && up2.d.categoria === 'home', 'gerente edita metadados');
ok((await call(dev, 'PUT', `media/${id}`, { categoria: 'invalida' })).s === 400, 'categoria inválida');

const rep = await call(dev, 'POST', `media/${id}/replace`, { data: b64(png(8, 6, 50)) });
ok(rep.s === 200 && rep.d.largura === 8 && rep.d.urlBase === up.d.urlBase, 'substitui mantendo URL');
const novo = Buffer.from(await (await fetch(base + up.d.urlBase)).arrayBuffer());
ok(novo.readUInt32BE(16) === 8, 'arquivo realmente trocado');
ok((await call(dev, 'POST', `media/${id}/replace`, { data: 'data:image/gif;base64,' + Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;').toString('base64') })).s === 400, 'troca de formato barrada');

// uso: coloca a imagem num banner e tenta excluir
const b = await call(dev, 'POST', 'banners', { title: 'Teste', image_desktop: up.d.urlBase, image_mobile: up.d.urlBase, is_active: 1, position: 'home_hero' });
const usado = await call(dev, 'DELETE', `media/${id}`);
if (b.s < 300) {
  ok(usado.s === 409 && usado.d.locais?.length >= 1, 'excluir em uso = 409 com locais');
  ok((await fetch(base + up.d.urlBase)).status === 200, 'arquivo em uso preservado');
  await call(dev, 'DELETE', `banners/${b.d.id}`);
} else console.log('(aviso) não foi possível criar banner de teste:', b.s, JSON.stringify(b.d));
const del = await call(dev, 'DELETE', `media/${id}`);
ok(del.s === 200, 'excluir sem uso OK ' + del.s);
ok((await fetch(base + up.d.urlBase)).status === 404, 'arquivo removido do disco');
ok((await call(dev, 'GET', `media/${id}`)).s === 404, 'registro removido');

const aud = await call(dev, 'GET', 'audit-logs');
const acoes = JSON.stringify(aud.d);
for (const a of ['MEDIA_UPLOADED', 'MEDIA_UPDATED', 'MEDIA_REPLACED', 'MEDIA_DELETED', 'MEDIA_UPLOAD_REJECTED']) ok(acoes.includes(a), 'auditoria ' + a);
console.log(falhas ? `${falhas}/${total} falha(s)` : `Biblioteca de mídia OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
