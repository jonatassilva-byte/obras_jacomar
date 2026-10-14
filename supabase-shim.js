// Liga a página ao Supabase, imitando a interface de banco de dados que ela já usa.
(function () {
  const cfg = window.OBRAS_CONFIG || {};
  const TABLE = 'obras_docs';
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function collection(path) {
    return {
      onSnapshot(cb, onErr) {
        let alive = true;
        const load = async () => {
          const { data, error } = await sb.from(TABLE).select('id,data').eq('collection', path);
          if (!alive) return;
          if (error) { if (onErr) onErr(error); return; }
          cb({ docs: data.map((r) => ({ id: r.id, data: () => r.data })) });
        };
        load();
        const ch = sb.channel('c:' + path + ':' + Math.random().toString(36).slice(2))
          .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: 'collection=eq.' + path }, load)
          .subscribe();
        return () => { alive = false; sb.removeChannel(ch); };
      },
      doc(id) {
        return {
          async set(data) {
            const { error } = await sb.from(TABLE).upsert({ path: path + '/' + id, collection: path, id, data, updated_at: new Date().toISOString() });
            if (error) throw error;
          },
          async delete() {
            const { error } = await sb.from(TABLE).delete().eq('path', path + '/' + id);
            if (error) throw error;
          },
        };
      },
    };
  }

  function loginScreen() {
    return new Promise((resolve) => {
      const app = document.getElementById('app');
      const pickLabel = document.getElementById('pick').closest('label');
      pickLabel.style.visibility = 'hidden';
      app.innerHTML = '';
      const f = document.createElement('form');
      f.className = 'card login';
      f.innerHTML = '<h2>Entrar</h2><p class="note">Use o e-mail e a senha cadastrados pelo administrador.</p>' +
        '<label>E-mail<input type="email" name="email" required autocomplete="username"></label>' +
        '<label>Senha<input type="password" name="senha" required autocomplete="current-password"></label>' +
        '<button class="primary" type="submit">Entrar</button><p class="note msg" role="alert"></p>';
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = f.querySelector('.msg');
        msg.textContent = 'Entrando…';
        const { data, error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value });
        if (error) { msg.textContent = 'E-mail ou senha incorretos.'; return; }
        pickLabel.style.visibility = '';
        app.innerHTML = '<div class="empty">Carregando obras…</div>';
        resolve(data.session);
      });
      app.append(f);
    });
  }

  function logoutButton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Sair';
    b.addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
    document.querySelector('.bar .wrap').append(b);
  }

  let ready = null;
  async function session() {
    if (!ready) ready = (async () => {
      const { data } = await sb.auth.getSession();
      const s = data.session || await loginScreen();
      logoutButton();
      return s;
    })();
    return ready;
  }

  window.claude = {
    async use(name) {
      await session();
      if (name === 'db') return { collection };
      if (name === 'user') return { can: async () => true };
      return null;
    },
  };
})();
