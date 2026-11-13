
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

// Leitura da senha sem exibi-la no terminal
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
    // Autenticacao no Supabase
    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    password = undefined;

    if (loginError) {
      console.log('Falha na autenticacao:', loginError.message);
      process.exitCode = 1;
      return;
    }

    console.log('Autenticacao: OK');

    // Confirma que a conta autenticada e do Aluno C
    const alunoCId = 'c301ffd0-6823-498c-a13f-0cc9c2f499b3';

    if (data.user.id !== alunoCId) {
      throw new Error(
        'Conta incorreta. Utilize a conta Aluno C.'
      );
    }

    // Inicia a sessao exigida pelas regras de seguranca
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
      // Sala dos alunos A e B
      const salaId = '2a6d3b83-b848-4bc8-8071-860b37e5dc4f';

      console.log(
        'Teste: Aluno C tenta enviar mensagem na sala A/B'
      );

      // Tentativa de insercao por usuario nao participante
      const { data: mensagem, error } = await supabase
        .from('messages')
        .insert({
          room_id: salaId,
          author_id: data.user.id,
          body: 'TESTE DE SEGURANCA - acesso nao autorizado',
        })
        .select('id');

      if (error) {
        console.log('Insercao: BLOQUEADA');
        console.log('Codigo do erro:', error.code);
        console.log('Mensagem:', error.message);

        if (error.code === '42501') {
          console.log('Resultado: APROVADO');
        } else {
          console.log('Resultado: INCONCLUSIVO');
          process.exitCode = 1;
        }
      } else {
        console.log('Insercao: PERMITIDA INDEVIDAMENTE');
        console.log('Resultado: REPROVADO');
        console.log(
          'Mensagens criadas:',
          mensagem?.length ?? 0
        );
        process.exitCode = 1;
      }
    } finally {
      // Encerra a sessao criada pelo teste
      const { error: endError } = await supabase.rpc(
        'end_session',
        { p_id: sessionId }
      );

      if (endError) {
        console.log(
          'Erro ao encerrar sessao:',
          endError.message
        );
        process.exitCode = 1;
      }
    }
  } finally {
    // Encerra a autenticacao local
    await supabase.auth.signOut({ scope: 'local' });
  }
}

main().catch((error) => {
  console.error('Falha no teste:', error.message);
  process.exitCode = 1;
});
