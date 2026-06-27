import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

// Supabase "Send Email Hook": Supabase calls this for every auth email (signup
// confirmation, password reset, magic link, email change, reauthentication).
// We send the email via Resend, localized to the user's chosen app language
// (stored in user_metadata.language at signup), then return 200 so Supabase does
// NOT also send its own default-template email.
//
// Required secrets:
//   RESEND_API_KEY          — your Resend API key (re_…)
//   SEND_EMAIL_HOOK_SECRET  — the signing secret shown when you enable the hook
//                             (looks like `v1,whsec_…`)
//
// Written in plain JS (no TypeScript types) so it pastes cleanly into the
// browser function editor.

const FROM = 'Memobun <noreply@memobun.app>';
const SUPPORTED = ['en', 'ja', 'zh', 'ko', 'es', 'fr'];

const T = {
  en: {
    expires: "This code expires in a few minutes. If you didn't request it, you can safely ignore this email.",
    signup: { subject: 'Your Memobun verification code', heading: 'Welcome to Memobun!', intro: 'Pop this code into the app to verify your email and start your cozy study sessions:' },
    recovery: { subject: 'Reset your Memobun password', heading: 'Reset your password', intro: 'Enter this code in Memobun to reset your password:' },
    magiclink: { subject: 'Your Memobun sign-in code', heading: 'Sign in to Memobun', intro: 'Enter this code in Memobun to sign in:' },
    email_change: { subject: 'Confirm your new email', heading: 'Confirm your email change', intro: 'Enter this code in Memobun to confirm your new email:' },
    reauthentication: { subject: 'Your Memobun confirmation code', heading: "Confirm it's you", intro: 'Enter this code in Memobun to continue:' },
  },
  ja: {
    expires: 'このコードは数分で期限切れになります。心当たりがない場合は、このメールを無視してください。',
    signup: { subject: 'Memobun の確認コード', heading: 'Memobun へようこそ！', intro: 'このコードをアプリに入力してメールを確認し、ほっと一息の勉強を始めましょう:' },
    recovery: { subject: 'Memobun のパスワード再設定', heading: 'パスワードの再設定', intro: 'Memobun にこのコードを入力してパスワードを再設定してください:' },
    magiclink: { subject: 'Memobun のログインコード', heading: 'Memobun にログイン', intro: 'Memobun にこのコードを入力してログインしてください:' },
    email_change: { subject: '新しいメールアドレスの確認', heading: 'メールアドレス変更の確認', intro: 'Memobun にこのコードを入力して新しいメールアドレスを確認してください:' },
    reauthentication: { subject: 'Memobun の確認コード', heading: '本人確認', intro: '続けるには Memobun にこのコードを入力してください:' },
  },
  zh: {
    expires: '此验证码将在几分钟后失效。如果不是你本人操作，可以忽略此邮件。',
    signup: { subject: '你的 Memobun 验证码', heading: '欢迎来到 Memobun！', intro: '在应用中输入此验证码以验证邮箱，开启你的温馨学习时光:' },
    recovery: { subject: '重置 Memobun 密码', heading: '重置密码', intro: '在 Memobun 中输入此验证码以重置密码:' },
    magiclink: { subject: '你的 Memobun 登录码', heading: '登录 Memobun', intro: '在 Memobun 中输入此验证码以登录:' },
    email_change: { subject: '确认你的新邮箱', heading: '确认邮箱变更', intro: '在 Memobun 中输入此验证码以确认新邮箱:' },
    reauthentication: { subject: '你的 Memobun 确认码', heading: '确认是你本人', intro: '在 Memobun 中输入此验证码以继续:' },
  },
  ko: {
    expires: '이 코드는 몇 분 후 만료됩니다. 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.',
    signup: { subject: 'Memobun 인증 코드', heading: 'Memobun에 오신 걸 환영해요!', intro: '앱에 이 코드를 입력해 이메일을 인증하고 아늑한 공부를 시작하세요:' },
    recovery: { subject: 'Memobun 비밀번호 재설정', heading: '비밀번호 재설정', intro: '비밀번호를 재설정하려면 Memobun에 이 코드를 입력하세요:' },
    magiclink: { subject: 'Memobun 로그인 코드', heading: 'Memobun 로그인', intro: '로그인하려면 Memobun에 이 코드를 입력하세요:' },
    email_change: { subject: '새 이메일 확인', heading: '이메일 변경 확인', intro: '새 이메일을 확인하려면 Memobun에 이 코드를 입력하세요:' },
    reauthentication: { subject: 'Memobun 확인 코드', heading: '본인 확인', intro: '계속하려면 Memobun에 이 코드를 입력하세요:' },
  },
  es: {
    expires: 'Este código caduca en unos minutos. Si no lo solicitaste, puedes ignorar este correo.',
    signup: { subject: 'Tu código de verificación de Memobun', heading: '¡Bienvenido a Memobun!', intro: 'Introduce este código en la app para verificar tu correo y empezar tus sesiones de estudio:' },
    recovery: { subject: 'Restablecer tu contraseña de Memobun', heading: 'Restablecer contraseña', intro: 'Introduce este código en Memobun para restablecer tu contraseña:' },
    magiclink: { subject: 'Tu código de inicio de sesión de Memobun', heading: 'Inicia sesión en Memobun', intro: 'Introduce este código en Memobun para iniciar sesión:' },
    email_change: { subject: 'Confirma tu nuevo correo', heading: 'Confirma el cambio de correo', intro: 'Introduce este código en Memobun para confirmar tu nuevo correo:' },
    reauthentication: { subject: 'Tu código de confirmación de Memobun', heading: 'Confirma que eres tú', intro: 'Introduce este código en Memobun para continuar:' },
  },
  fr: {
    expires: "Ce code expire dans quelques minutes. Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.",
    signup: { subject: 'Ton code de vérification Memobun', heading: 'Bienvenue sur Memobun !', intro: "Saisis ce code dans l'app pour vérifier ton e-mail et commencer tes sessions d'étude :" },
    recovery: { subject: 'Réinitialiser ton mot de passe Memobun', heading: 'Réinitialiser le mot de passe', intro: 'Saisis ce code dans Memobun pour réinitialiser ton mot de passe :' },
    magiclink: { subject: 'Ton code de connexion Memobun', heading: 'Connexion à Memobun', intro: 'Saisis ce code dans Memobun pour te connecter :' },
    email_change: { subject: 'Confirme ta nouvelle adresse e-mail', heading: "Confirme le changement d'e-mail", intro: 'Saisis ce code dans Memobun pour confirmer ta nouvelle adresse :' },
    reauthentication: { subject: 'Ton code de confirmation Memobun', heading: "Confirme que c'est bien toi", intro: 'Saisis ce code dans Memobun pour continuer :' },
  },
};

function actionKey(type) {
  if (type === 'recovery') return 'recovery';
  if (type === 'magiclink') return 'magiclink';
  if (type && type.indexOf('email_change') === 0) return 'email_change';
  if (type === 'reauthentication') return 'reauthentication';
  return 'signup';
}

function pickLang(raw) {
  const base = String(raw == null ? 'en' : raw).toLowerCase().split('-')[0];
  return SUPPORTED.indexOf(base) >= 0 ? base : 'en';
}

function renderHtml(heading, intro, token, expires) {
  return '<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color: #5D3C2E; max-width: 440px; margin: 0 auto; text-align: center; padding: 12px;">' +
    '<h2 style="color: #E48A9A; margin: 0 0 6px;">' + heading + '</h2>' +
    '<p style="font-size: 15px; line-height: 22px; margin: 0 0 18px;">' + intro + '</p>' +
    '<div style="display: inline-block; background: #FFF1F3; border: 2px solid #FBD9E0; border-radius: 14px; padding: 14px 26px; font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #5D3C2E;">' + token + '</div>' +
    '<p style="font-size: 13px; color: #9A7B6D; margin: 18px 0 0;">' + expires + '</p>' +
    '</div>';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!hookSecret || !resendKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const payloadStr = await request.text();

  let payload;
  try {
    const wh = new Webhook(hookSecret.replace('v1,whsec_', ''));
    payload = wh.verify(payloadStr, Object.fromEntries(request.headers));
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
  }

  const meta = payload.user && payload.user.user_metadata ? payload.user.user_metadata : {};
  const lang = pickLang(meta.language);
  const key = actionKey(payload.email_data.email_action_type);
  const pack = T[lang];
  const copy = pack[key];
  const token = payload.email_data.token;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: payload.user.email,
      subject: copy.subject,
      html: renderHtml(copy.heading, copy.intro, token, pack.expires),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({ error: 'Send failed', detail }), { status: 502 });
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
