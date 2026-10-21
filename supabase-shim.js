// Liga a página ao Supabase, imitando a interface de banco de dados que ela já usa.
// Quando algo da configuração está errado, mostra na tela o problema e como corrigir.
(function () {
  const TABLE = 'obras_docs';
  const PLACEHOLDER = /SEU-PROJETO|COLE-AQUI/i;
  const COPIAR = 'No Supabase, abra a página inicial do projeto (Project Overview), clique em Copy ao lado do endereço e copie a Project URL e a Publishable key (começa com sb_publishable_). A chave também fica em Project Settings > API Keys.';
  const SAIU = ['Sua sessão terminou', 'Você saiu da conta nesta ou em outra aba, ou o login expirou. Recarregue a página e entre de novo.'];
  const app = () => document.getElementById('app');
  let saiu = false;

  // ---------- mensagens na tela ----------
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  }
  function travarBarra(travar) {
    const pick = document.getElementById('pick');
    if (pick) pick.closest('label').style.visibility = travar ? 'hidden' : '';
    const home = document.getElementById('home');
    if (home) home.disabled = !!travar;
  }
  function problema(titulo, ...linhas) {
    travarBarra(true);
    app().replaceChildren(el('section', { class: 'card setup-erro', role: 'alert' },
      el('h2', { text: titulo }),
      ...linhas.map((l) => (typeof l === 'string' ? el('p', { text: l }) : l))));
  }
  const codigo = (t) => el('pre', { class: 'setup-code', text: t });
  function aviso(texto) {
    let a = document.getElementById('sb-aviso');
    if (!texto) { if (a) a.remove(); return; }
    if (!a) { a = el('div', { id: 'sb-aviso', class: 'wrap', role: 'status' }, el('div', { class: 'sb-aviso-txt' })); app().before(a); }
    a.firstChild.textContent = texto;
  }
  const nunca = () => new Promise(() => {});

  // ---------- configuração ----------
  // Confere o config.js mesmo que o index.html publicado seja de uma versão antiga.
  async function conferirArquivoConfig() {
    if (window.OBRAS_CONFIG || window.__cfgErro || window.__cfgFaltando) return;
    try {
      const r = await fetch('config.js', { cache: 'no-store' });
      if (!r.ok) { window.__cfgFaltando = true; return; }
      try { new Function(await r.text()); } catch (e) { window.__cfgErro = String(e.message || e); }
    } catch { /* sem rede: o erro aparece depois, ao falar com o Supabase */ }
  }
  function lerConfig() {
    if (window.__cfgErro) {
      return { erro: ['O arquivo config.js tem um erro de digitação',
        `O navegador acusou: ${window.__cfgErro}.`,
        'Normalmente é uma aspa ou vírgula faltando. O arquivo deve ficar exatamente neste formato, trocando só o que está entre aspas (a URL termina em .supabase.co, sem /rest/v1/):',
        codigo("window.OBRAS_CONFIG = {\n  SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',\n  SUPABASE_ANON_KEY: 'sb_publishable_...',\n};")] };
    }
    if (window.__cfgFaltando || !window.OBRAS_CONFIG) {
      return { erro: ['O arquivo config.js não foi encontrado',
        'Confira se o config.js foi enviado para o GitHub na mesma pasta do index.html, com esse nome exato (tudo minúsculo).'] };
    }
    const cfg = window.OBRAS_CONFIG;
    const url = String(cfg.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth|realtime|storage)\/v1.*$/i, '').replace(/\/+$/, '');
    const key = String(cfg.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key || PLACEHOLDER.test(url) || PLACEHOLDER.test(key)) {
      return { erro: ['Faltam os dados do Supabase no config.js', COPIAR + ' Cole as duas no config.js no lugar dos textos de exemplo.'] };
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) {
      return { erro: ['A URL do Supabase no config.js não parece certa',
        `Está escrito: ${cfg.SUPABASE_URL}`,
        'Ela deve ter só o endereço do projeto, no formato https://xxxxxxxxxxxx.supabase.co, sem nada depois do .co.'] };
    }
    if (/^sb_secret_/i.test(key) || papelDaChave(key) === 'service_role') {
      return { erro: ['Essa é a chave secreta do Supabase',
        'Ela dá acesso total ao banco e não pode ficar no site. Troque no config.js pela Publishable key (começa com sb_publishable_) e, por segurança, gere uma nova chave secreta no Supabase em Project Settings > API Keys.'] };
    }
    return { url, key };
  }
  function papelDaChave(k) {
    try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch { return null; }
  }

  // ---------- erros do Supabase em português ----------
  const ehRede = (m) => /failed to fetch|networkerror|load failed|network request failed/i.test(m);
  function explicar(err, status) {
    if (saiu) return SAIU;
    const m = err && typeof err === 'object'
      ? String(err.message || err.error_description || err.msg || (Object.keys(err).length ? JSON.stringify(err) : ''))
      : String(err || '');
    const c = String((err && err.code) || '');
    if (c === 'PGRST205' || c === '42P01' || /could not find the table|does not exist/i.test(m)) {
      return ['A tabela das obras ainda não existe no Supabase',
        'No Supabase, abra o SQL Editor, cole todo o conteúdo do arquivo 1-criar-tabela.sql e clique em Run. Depois rode também o 2-dados-borda.sql e recarregue esta página.'];
    }
    if (/invalid api key|no api key|apikey|api key/i.test(m) || (status === 401 && !c)) {
      return ['A chave do Supabase no config.js não foi aceita',
        COPIAR + ' Cole a chave inteira no config.js, sem espaços nem quebras de linha.'];
    }
    if (c === 'PGRST301' || c === 'PGRST303' || /jwt/i.test(m)) return SAIU;
    if (c === '42501' || /permission denied|row-level security/i.test(m)) {
      return ['O Supabase recusou o acesso à tabela',
        'As regras de acesso não foram criadas. Rode de novo o arquivo 1-criar-tabela.sql no SQL Editor do Supabase.'];
    }
    if (ehRede(m) || status === 0 || status >= 500) {
      return ['Não foi possível falar com o Supabase',
        'Confira a internet, a URL no config.js e se o projeto do Supabase está ativo. Projetos gratuitos são pausados depois de uma semana com pouco uso; para reativar, abra o painel do Supabase, entre no projeto e clique em Resume project.'];
    }
    return ['O Supabase devolveu um erro', m || 'Erro desconhecido.'];
  }

  // ---------- banco de dados ----------
  function criarDb(sb) {
    async function semSessao() {
      try { return !(await sb.auth.getSession()).data.session; } catch { return false; }
    }
    function collection(path) {
      return {
        onSnapshot(cb, onErr) {
          let alive = true, seq = 0, ok = false;
          const load = async () => {
            const my = ++seq;
            let res;
            try { res = await sb.from(TABLE).select('id,data').eq('collection', path); }
            catch (e) { res = { error: e, status: 0 }; }
            if (!alive || my !== seq) return;
            const { data, error, status } = res;
            if (error) {
              console.error('Supabase:', error);
              if (!saiu && String(error.code) === '42501' && await semSessao()) saiu = true;
              const [t, ...ls] = explicar(error, status);
              if (path === 'obras' && !ok) problema(t, ...ls);
              else { aviso(t + '. ' + ls.join(' ')); if (onErr && path !== 'obras') onErr(error); }
              return;
            }
            const rows = Array.isArray(data) ? data : [];
            if (path === 'obras') {
              if (!ok) travarBarra(false);
              aviso(rows.length ? '' : 'O banco está vazio. Para carregar a obra Borda do Campo, rode o arquivo 2-dados-borda.sql no SQL Editor do Supabase e recarregue a página.');
            }
            ok = true;
            cb({ docs: rows.map((r) => ({ id: r.id, data: () => r.data })) });
          };
          load();
          const ch = sb.channel('obras-' + path.replace(/[^a-z0-9-]/gi, '-') + '-' + Math.random().toString(36).slice(2))
            .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: 'collection=eq.' + path }, load)
            .subscribe((st) => { if (st === 'SUBSCRIBED') load(); });
          return () => { alive = false; sb.removeChannel(ch); };
        },
        doc(id) {
          const falhou = (error, status) => { console.error('Supabase:', error); return new Error(explicar(error, status).join(': ')); };
          return {
            async set(data) {
              const { error, status } = await sb.from(TABLE).upsert({ path: path + '/' + id, collection: path, id, data, updated_at: new Date().toISOString() });
              if (error) throw falhou(error, status);
            },
            async delete() {
              const { error, status } = await sb.from(TABLE).delete().eq('path', path + '/' + id);
              if (error) throw falhou(error, status);
            },
          };
        },
      };
    }
    const falhou = (error, status) => { console.error('Supabase:', error); return new Error(explicar(error, status).join(': ')); };
    // grava vários documentos numa única requisição (uma só transação no banco: ou grava tudo, ou nada)
    async function gravarVarios(docs) {
      const agora = new Date().toISOString();
      const { error, status } = await sb.from(TABLE).upsert(docs.map((d) => ({ path: d.collection + '/' + d.id, collection: d.collection, id: d.id, data: d.data, updated_at: agora })));
      if (error) throw falhou(error, status);
    }
    // apaga a obra e todos os lotes de notas dela numa única requisição
    async function apagarObra(id) {
      const { error, status } = await sb.from(TABLE).delete().or(`path.eq."obras/${id}",collection.eq."obras/${id}/notas"`);
      if (error) throw falhou(error, status);
    }
    return { collection, gravarVarios, apagarObra };
  }

  // ---------- login ----------
  function mensagemLogin(error) {
    const m = String(error.message || error);
    const code = String(error.code || '');
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(m)) return 'Este usuário ainda não foi confirmado. No Supabase, em Authentication > Users, apague e crie de novo deixando marcado Auto confirm user?.';
    if (/invalid api key|no api key|api key/i.test(m) || error.status === 401) return 'A chave do Supabase no config.js não foi aceita. Copie de novo a Publishable key em Project Settings > API Keys.';
    if (error.name === 'AuthRetryableFetchError' || error.status === 0 || error.status >= 500 || ehRede(m)) return 'Não foi possível falar com o Supabase. Confira a internet, a URL no config.js e se o projeto não está pausado.';
    return 'Não foi possível entrar: ' + m;
  }
  function telaLogin(sb) {
    return new Promise((resolve) => {
      travarBarra(true);
      const f = el('form', { class: 'card login' });
      const msg = el('p', { class: 'note msg', role: 'alert' });
      const email = el('input', { type: 'email', name: 'email', required: '', autocomplete: 'username' });
      const senha = el('input', { type: 'password', name: 'senha', required: '', autocomplete: 'current-password' });
      const entrar = el('button', { class: 'primary', type: 'submit', text: 'Entrar' });
      f.append(el('h2', { text: 'Entrar' }), el('p', { class: 'note', text: 'Use o e-mail e a senha cadastrados pelo administrador.' }),
        el('label', {}, 'E-mail', email), el('label', {}, 'Senha', senha), entrar, msg);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (entrar.disabled) return;
        entrar.disabled = true;
        msg.textContent = 'Entrando…';
        let res;
        try { res = await sb.auth.signInWithPassword({ email: email.value.trim(), password: senha.value }); }
        catch (err) { res = { error: err }; }
        const { data, error } = res;
        if (error) { msg.textContent = mensagemLogin(error); entrar.disabled = false; return; }
        app().replaceChildren(el('div', { class: 'empty', text: 'Carregando obras…' }));
        resolve(data.session);
      });
      app().replaceChildren(f);
      email.focus();
    });
  }

  function botaoSair(sb) {
    const b = el('button', { type: 'button', text: 'Sair' });
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await sb.auth.signOut({ scope: 'local' }); } catch { /* segue */ }
      try { Object.keys(localStorage).filter((k) => /^sb-.+-auth-token$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* segue */ }
      location.reload();
    });
    document.querySelector('.bar .wrap').append(b);
  }

  // ---------- início ----------
  let pronto = null;
  function iniciar() {
    if (pronto) return pronto;
    pronto = (async () => {
      try {
        await conferirArquivoConfig();
        const cfg = lerConfig();
        if (cfg.erro) { problema(...cfg.erro); return nunca(); }
        if (!window.supabase || !window.supabase.createClient) {
          problema('Não foi possível carregar a biblioteca do Supabase',
            'Ela vem de cdn.jsdelivr.net. Confira a internet ou se a rede da empresa bloqueia esse endereço, e recarregue a página.');
          return nunca();
        }
        const sb = window.supabase.createClient(cfg.url, cfg.key);
        let sessao = null;
        try { sessao = (await sb.auth.getSession()).data.session; } catch { sessao = null; }
        if (!sessao) await telaLogin(sb);
        botaoSair(sb);
        sb.auth.onAuthStateChange((ev) => {
          if (ev === 'SIGNED_OUT' && !saiu) { saiu = true; aviso(SAIU.join('. ')); }
        });
        return criarDb(sb);
      } catch (err) {
        console.error(err);
        problema('Erro inesperado ao iniciar', String((err && err.message) || err));
        return nunca();
      }
    })();
    return pronto;
  }

  window.claude = {
    async use(name) {
      const db = await iniciar();
      if (name === 'db') return db;
      if (name === 'user') return { can: async () => true };
      return null;
    },
  };
})();
