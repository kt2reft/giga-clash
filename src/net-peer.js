// =====================================================================
// GIGA-CLASH  net-peer.js — claude.ai 以外（GitHub Pages など）でのオンライン通信
//   ブラウザ同士を WebRTC で直接つなぐ（PeerJS の公開サーバーで相手を探す）。
//   部屋を作った人が「ハブ」になり、全員の状態を中継する。
//   main.js からは claude.ai の room と同じ形（presence / peers）で使える。
// =====================================================================
import { Peer } from 'peerjs';

const PREFIX = 'gigaclash-v2-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newRoomCode = () => Array.from({ length: 5 }, () => ALPHA[(Math.random() * ALPHA.length) | 0]).join('');
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] };
// 接続サーバーの指定（通常は PeerJS の公開サーバー。?peerhost=… で自前サーバーに切り替え可能）
function serverOpts() {
  const q = new URLSearchParams(location.search), o = { config: ICE, debug: 0 };
  if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 443); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') !== '0'; }
  return o;
}

function merge(obj, patch) { for (const k in patch) { if (patch[k] === null) delete obj[k]; else obj[k] = patch[k]; } }

/**
 * @param {{code:string, host:boolean, onStatus:(s:string, detail?:string)=>void}} o
 *   status: 'connecting' | 'ready' | 'lost' | 'error'
 */
export function createPeerRoom({ code, host, onStatus = () => { } }) {
  const hubId = PREFIX + code;
  const others = new Map();            // peerId -> presence
  const conns = new Map();             // （ハブのみ）peerId -> DataConnection
  const seen = new Map();              // 最後に連絡があった時刻（切断の検出用）
  let hubSeen = 0, t0 = Date.now();
  let myId = null, mine = {}, pending = null, cache = null, hubConn = null, closed = false, ok = false;
  const status = (s, d) => { if (!closed) onStatus(s, d); };
  const peer = host ? new Peer(hubId, serverOpts()) : new Peer(serverOpts());
  const send = (c, m) => { try { if (c && c.open) c.send(m); } catch (e) { } };
  const changed = () => { cache = null; };

  peer.on('open', id => {
    myId = id; changed();
    if (host) { ok = true; status('ready'); return; }
    hubConn = peer.connect(hubId, { reliable: true, serialization: 'json' });
    hubConn.on('open', () => { ok = true; hubSeen = Date.now(); send(hubConn, { t: 'p', p: mine }); status('ready'); });
    hubConn.on('data', m => {
      if (!m || typeof m !== 'object') return; hubSeen = Date.now();
      if (m.t === 'full' && Array.isArray(m.peers)) { others.clear(); for (const [id, p] of m.peers) if (id !== myId) others.set(id, p || {}); changed(); }
      else if (m.t === 'p' && m.id !== myId) { const p = others.get(m.id) || {}; merge(p, m.p || {}); others.set(m.id, p); changed(); }
      else if (m.t === 'leave') { others.delete(m.id); changed(); }
      else if (m.t === 'full_room') status('error', 'この部屋は満員です（最大8人）');
      else if (m.t === 'bye') { others.clear(); changed(); status('lost', 'ホストが部屋を閉じました'); }
    });
    hubConn.on('close', () => { if (!closed) { others.clear(); changed(); status('lost', 'ホストとの接続が切れました'); } });
    hubConn.on('error', () => { });
  });
  peer.on('connection', c => {
    if (!host) { c.close(); return; }
    if (conns.size >= 7) { c.on('open', () => { send(c, { t: 'full_room' }); setTimeout(() => c.close(), 300); }); return; }
    c.on('open', () => {
      seen.set(c.peer, Date.now()); conns.set(c.peer, c); others.set(c.peer, {}); changed();
      const all = [[myId, mine]]; for (const [id, p] of others) if (id !== c.peer) all.push([id, p]);
      send(c, { t: 'full', peers: all });
    });
    c.on('data', m => {
      seen.set(c.peer, Date.now());
      if (m && m.t === 'bye') { gone(); return; }
      if (!m || typeof m !== 'object' || m.t !== 'p' || !m.p || typeof m.p !== 'object') return;
      const p = others.get(c.peer) || {}; merge(p, m.p); others.set(c.peer, p); changed();
      for (const [id, o] of conns) if (id !== c.peer) send(o, { t: 'p', id: c.peer, p: m.p });
    });
    const gone = () => { if (!conns.has(c.peer)) return; try { c.close(); } catch (e) { } conns.delete(c.peer); seen.delete(c.peer); others.delete(c.peer); changed(); for (const o of conns.values()) send(o, { t: 'leave', id: c.peer }); };
    c.on('close', gone); c.on('error', gone);
  });
  peer.on('disconnected', () => { if (!closed) { try { peer.reconnect(); } catch (e) { } } });
  peer.on('error', e => {
    const t = e && e.type;
    if (t === 'unavailable-id') status('error', 'その部屋コードはすでに使われています');
    else if (t === 'peer-unavailable') status('error', '部屋が見つかりません（コードを確認するか、ホストに部屋を作り直してもらってください）');
    else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') { if (!ok) status('error', '接続サーバーにつながりません。ネットワークを確認してください'); }
    else if (t === 'browser-incompatible') status('error', 'このブラウザはオンライン対戦に対応していません');
    else if (!ok) status('error', '接続できませんでした');
  });
  // 生存確認：1秒ごとに合図を送り、6秒途絶えたら切断とみなす
  const beat = setInterval(() => {
    const now = Date.now();
    if (host) {
      for (const c of conns.values()) send(c, { t: 'hb' });
      for (const [id, t] of seen) if (now - t > 6000) { const c = conns.get(id); if (c) { try { c.close(); } catch (e) { } conns.delete(id); } seen.delete(id); others.delete(id); changed(); for (const o of conns.values()) send(o, { t: 'leave', id }); }
    } else {
      if (ok) { send(hubConn, { t: 'hb' }); if (now - hubSeen > 6000) { ok = false; status('lost', 'ホストとの接続が切れました'); } }
      else if (now - t0 > 15000) status('error', '部屋に入れませんでした（コードが違うか、ホストのネットワークが対応していない可能性があります）');
    }
  }, 1000);
  const bye = () => { if (host) for (const c of conns.values()) send(c, { t: 'bye' }); else send(hubConn, { t: 'bye' }); };
  addEventListener('pagehide', bye);
  // 30回/秒にまとめて送る
  const timer = setInterval(() => {
    if (!pending || !myId) return; const p = pending; pending = null;
    if (host) for (const c of conns.values()) send(c, { t: 'p', id: myId, p }); else send(hubConn, { t: 'p', p });
  }, 33);

  return {
    hubId, code, isHub: host,
    presence(patch) { merge(mine, patch); pending = pending ? Object.assign(pending, patch) : { ...patch }; changed(); return Promise.resolve(); },
    peers() {
      if (!cache) {
        const arr = [];
        if (myId) arr.push(Object.freeze({ peer: myId, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze({ ...mine }), updatedAt: Date.now() }));
        for (const [id, p] of others) arr.push(Object.freeze({ peer: id, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze({ ...p }), updatedAt: Date.now() }));
        cache = Object.freeze(arr);
      }
      return cache;
    },
    connected: () => ok && !closed,
    close() { bye(); closed = true; clearInterval(timer); clearInterval(beat); removeEventListener('pagehide', bye); try { if (hubConn) hubConn.close(); for (const c of conns.values()) c.close(); peer.destroy(); } catch (e) { } },
  };
}
