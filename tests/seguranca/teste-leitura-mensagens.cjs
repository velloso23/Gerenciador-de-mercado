
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

    if (loginError) {
      console.log('Falha na autenticacao:', loginError.message);
      return;
    }

    console.log('Autenticacao: OK');

    // Garante que o teste usa a conta Aluno C.
    const alunoCId = 'c301ffd0-6823-498c-a13f-0cc9c2f499b3';

    if (data.user.id !== alunoCId) {
      throw new Error('Conta incorreta. Utilize a conta Aluno C.');
    }

    const { data: sessionId, error: sessionError } =
      await supabase.rpc('begin_session');

    if (sessionError || !sessionId) {
      throw new Error(
        'Nao foi possivel iniciar a sessao: ' +
        (sessionError?.message ?? 'ID ausente')
      );
    }

    console.log('Sessao da aplicacao: OK');

    try {
      const salaId = '2a6d3b83-b848-4bc8-8071-860b37e5dc4f';

      console.log('Teste: Aluno C consulta mensagens da sala A/B');

      const { data: mensagens, error } = await supabase
        .from('messages')
        .select('id')
        .eq('room_id', salaId);

      if (error) {
        console.log('Consulta: ERRO');
        console.log('Codigo:', error.code);
        console.log('Mensagem:', error.message);
        console.log('Resultado: REPROVADO');
        process.exitCode = 1;
      } else {
        const quantidade = mensagens?.length ?? 0;

        console.log('Mensagens encontradas:', quantidade);

        if (quantidade === 0) {
          console.log('Resultado: APROVADO');
        } else {
          console.log('Resultado: REPROVADO');
          console.log(
            'Falha: usuario externo conseguiu consultar mensagens.'
          );
          process.exitCode = 1;
        }
      }
    } finally {
      const { error: endError } = await supabase.rpc(
        'end_session',
        { p_id: sessionId }
      );

      if (endError) {
        console.log('Erro ao encerrar sessao:', endError.message);
        process.exitCode = 1;
      }
    }
  } finally {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

main().catch((error) => {
  console.error('Falha no teste:', error.message);
  process.exitCode = 1;
});
