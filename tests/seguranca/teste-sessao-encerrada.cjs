
const { createClient } = require('@supabase/supabase-js');
const readline = require('node:readline/promises');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function lerSenhaOculta() {
  return new Promise((resolve, reject) => {
    const entrada = process.stdin;
    const saida = process.stdout;

    if (!entrada.isTTY || !saida.isTTY || !entrada.setRawMode) {
      reject(new Error('Use um terminal interativo.'));
      return;
    }

    saida.write('Senha da conta de teste (oculta): ');

    let senha = '';
    const modoAnterior = entrada.isRaw;

    function finalizar() {
      entrada.removeListener('data', receber);
      entrada.setRawMode(modoAnterior ?? false);
      entrada.pause();
      saida.write('\n');
    }

    function receber(buffer) {
      const texto = buffer.toString('utf8');

      if (texto === '\r' || texto === '\n') {
        finalizar();
        resolve(senha);
      } else if (texto === '\u0003') {
        finalizar();
        reject(new Error('Operacao cancelada.'));
      } else if (texto === '\u007f' || texto === '\b') {
        senha = senha.slice(0, -1);
      } else {
        senha += texto;
      }
    }

    entrada.setRawMode(true);
    entrada.resume();
    entrada.on('data', receber);
  });
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let email;
  let password;
  let sessionId = null;
  let sessaoEncerrada = false;

  try {
    email = (await rl.question('Email da conta de teste: ')).trim();
  } finally {
    rl.close();
  }

  password = await lerSenhaOculta();

  try {
    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    password = undefined;

    if (loginError || !data.user) {
      throw new Error(
        'Falha na autenticacao: ' +
        (loginError?.message ?? 'Usuario ausente')
      );
    }

    const alunoAId = '2c54569b-e610-445d-a405-6387d2374c99';

    if (data.user.id !== alunoAId) {
      throw new Error('Conta incorreta. Utilize o Aluno A.');
    }

    console.log('Autenticacao: OK');

    const { data: leaseId, error: sessionError } =
      await supabase.rpc('begin_session');

    if (sessionError || !leaseId) {
      throw new Error(
        'Erro ao iniciar sessao: ' +
        (sessionError?.message ?? 'ID ausente')
      );
    }

    sessionId = leaseId;

    console.log('Sessao da aplicacao: OK');

    // Teste 1: acesso antes do encerramento
    const { data: antes, error: erroAntes } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id);

    if (erroAntes) {
      throw new Error(
        'Erro na consulta inicial: ' + erroAntes.message
      );
    }

    const quantidadeAntes = antes?.length ?? 0;

    console.log(
      'Antes de end_session:',
      quantidadeAntes,
      'registro(s)'
    );

    if (quantidadeAntes !== 1) {
      throw new Error(
        'Teste inconclusivo: perfil nao estava acessivel antes.'
      );
    }

    // Encerra somente a sessao da aplicacao
    const { error: endError } = await supabase.rpc(
      'end_session',
      { p_id: sessionId }
    );

    if (endError) {
      throw new Error(
        'Falha ao encerrar sessao: ' + endError.message
      );
    }

    // Confirma que a sessao foi realmente removida
    const { data: ativa, error: activeError } =
      await supabase.rpc('has_active_session');

    if (activeError) {
      throw new Error(
        'Falha ao verificar sessao: ' + activeError.message
      );
    }

    if (ativa !== false) {
      throw new Error(
        'Sessao ainda aparece como ativa apos end_session.'
      );
    }

    sessaoEncerrada = true;

    console.log('Sessao da aplicacao: ENCERRADA');

    // Verifica se o JWT permanece disponivel
    const { data: authData, error: authError } =
      await supabase.auth.getSession();

    if (authError || !authData.session?.access_token) {
      throw new Error(
        'JWT indisponivel apos encerrar a sessao.'
      );
    }

    console.log('JWT ainda presente: SIM');

    // Teste 2: acesso com o mesmo JWT, sem nova sessao
    const { data: depois, error: erroDepois } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id);

    if (erroDepois) {
      throw new Error(
        'Erro na consulta final: ' + erroDepois.message
      );
    }

    const quantidadeDepois = depois?.length ?? 0;

    console.log(
      'Depois de end_session:',
      quantidadeDepois,
      'registro(s)'
    );

    if (quantidadeDepois === 0) {
      console.log('Resultado: APROVADO');
    } else {
      console.log('Resultado: REPROVADO');
      console.log(
        'Falha: perfil acessivel com sessao encerrada.'
      );
      process.exitCode = 1;
    }
  } finally {
    // Limpeza em caso de falha antes do encerramento
    if (sessionId && !sessaoEncerrada) {
      const { error } = await supabase.rpc(
        'end_session',
        { p_id: sessionId }
      );

      if (error) {
        console.log(
          'Erro na limpeza da sessao:',
          error.message
        );
        process.exitCode = 1;
      }
    }

    await supabase.auth.signOut({ scope: 'local' });
  }
}

main().catch((error) => {
  console.error('Falha no teste:', error.message);
  process.exitCode = 1;
});
