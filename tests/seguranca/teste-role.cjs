
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

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'aluno' })
      .eq('id', data.user.id);

    if (error) {
      console.log('Alteracao de role: BLOQUEADA');
      console.log('Codigo do erro:', error.code);
      console.log('Mensagem:', error.message);
    } else {
      console.log('ATENCAO: operacao sem erro.');
      console.log('Investigar antes de considerar o teste aprovado.');
    }
  } finally {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

main().catch((error) => {
  console.error('Falha no teste:', error.message);
  process.exitCode = 1;
});
