const { add } = require('../core/registry');
const protection = require('../core/protection');
const cfg = require('../core/config');

const state = v => (v ? '🟢 activé' : '🔴 désactivé');
const DEFAULTS = {
  welcome: '👋 *BIENVENUE*\n\nSalut @user, bienvenue dans *@group* ! 🎉\nNous sommes maintenant *@count* membres.\n\nLis la description du groupe et respecte les règles.',
  goodbye: '👋 *AU REVOIR*\n\n@user a quitté *@group*.\nIl reste *@count* membres. À bientôt peut-être !'
};

// Remplace @user, @group et @count dans le message
const render = (tpl, { user, group, count }) =>
  tpl.replace(/@user/gi, user).replace(/@group/gi, group).replace(/@count/gi, String(count));

for (const key of ['welcome', 'goodbye']) {
  const msgKey = key + 'Msg';
  const label = key === 'welcome' ? 'message de bienvenue' : "message d'au revoir";
  add({
    name: key, cat: 'protection', desc: `activer le ${label} (modifiable)`,
    use: `${key} on | off | set message | reset`, group: true, admin: true,
    async run(ctx) {
      const g = protection.groupCfg(ctx.store, ctx.from);
      const sub = (ctx.args[0] || '').toLowerCase();

      if (sub === 'on' || sub === 'off') {
        g[key] = sub === 'on'; ctx.store.save();
        return ctx.reply(`${sub === 'on' ? '🟢' : '🔴'} *${key}* ${sub === 'on' ? 'activé' : 'désactivé'}.`);
      }
      if (sub === 'set') {
        const t = ctx.args.slice(1).join(' ').trim();
        if (!t) return ctx.reply(`👉 Utilise : *${key} set ton message*\n\nVariables : *@user* (le membre), *@group* (nom du groupe), *@count* (nombre de membres)`);
        g[msgKey] = t.slice(0, 700); g[key] = true; ctx.store.save();
        return ctx.reply(`✅ Message enregistré et *${key}* activé.\n\n${render(g[msgKey], { user: '@membre', group: ctx.meta?.subject || 'Groupe', count: ctx.meta?.participants?.length || 0 })}`);
      }
      if (sub === 'reset') {
        delete g[msgKey]; ctx.store.save();
        return ctx.reply('♻️ Message remis à la version d\'origine.');
      }
      await ctx.reply(`${key === 'welcome' ? '🎉' : '👋'} *${key}* : ${state(g[key])}\n\n*${key} on* : activer\n*${key} off* : désactiver\n*${key} set message* : personnaliser (variables : @user, @group, @count)\n*${key} reset* : message d'origine\n\n_Message actuel :_\n${g[msgKey] || DEFAULTS[key]}`);
    }
  });
}

// Appelé par core/handler.js quand des membres arrivent ou partent
async function announce(s, ev, meta) {
  const key = ev.action === 'add' ? 'welcome' : (ev.action === 'remove' || ev.action === 'leave') ? 'goodbye' : null;
  if (!key) return;
  const g = protection.groupCfg(s.store, ev.id);
  if (!g[key]) return;
  const { num } = require('../lib/util');
  const botNum = num(s.sock.user?.id);
  const list = ev.participants.map(p => (typeof p === 'string' ? { id: p } : p)).filter(p => num(p.id) !== botNum);
  for (const p of list) {
    // les membres bannis sont retirés automatiquement : pas de message
    if (g.banned?.[num(p.phoneNumber || p.id)]) continue;
    const tpl = g[key + 'Msg'] || DEFAULTS[key];
    const text = render(tpl, { user: '@' + num(p.id), group: meta?.subject || 'le groupe', count: meta?.participants?.length ?? '?' });
    try { await s.sock.sendMessage(ev.id, { text: `${text}\n\n> ${cfg.BRAND} 🇬🇳`, mentions: [p.id] }); } catch {}
  }
}

module.exports = { announce };
