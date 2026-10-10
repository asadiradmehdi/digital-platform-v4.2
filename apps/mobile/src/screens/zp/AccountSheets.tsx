// In-app account actions that used to say «از نسخه‌ی وب»: rename, prove a phone number, change the password,
// two-step sign-in. Every rule (SMS proofs, strength, step-up) is enforced by the server; these are the forms.
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { normalizeIranMobile } from '@digital-platform/api-contracts';
import { errorText } from '../../api/app';
import { account, type OtpChallenge } from '../../api/client';
import { C, card, faNum, right, row } from '../../zp/base';
import { CodeBoxes } from '../../zp/CodeBoxes';
import { Field } from '../../zp/Field';
import { Cta, ErrorBox, Press, Sheet, T } from '../../zp/ui';

type SheetProps = { open: boolean; onClose: () => void; done: (message: string) => void };

/** SMS code entry with a resend countdown; calls `onCode` once all six digits are in. */
function CodeStep({ challenge, onCode, onResend, busy, error }: {
  challenge: OtpChallenge; onCode: (code: string) => void; onResend: () => void; busy: boolean; error: string | null;
}) {
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(challenge.resendIn);
  useEffect(() => { setCode(''); setLeft(challenge.resendIn); }, [challenge]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <>
      <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>
        کد ۶ رقمی به <T w="b" size={12.5} color={C.ink2} style={{ writingDirection: 'ltr' }}>{`⁦${challenge.maskedPhone}⁩`}</T> پیامک شد.
      </T>
      <CodeBoxes value={code} disabled={busy} invalid={Boolean(error)} onChange={v => { setCode(v); if (v.length === 6) onCode(v); }} />
      {error ? <ErrorBox text={error} /> : null}
      <View style={{ alignItems: 'center', minHeight: 28, justifyContent: 'center' }}>
        {left > 0
          ? <T size={12.5} color={C.muted}>ارسال دوباره تا {faNum(left)} ثانیه</T>
          : <Press accessibilityRole="button" onPress={onResend} hitSlop={8}><T w="b" size={12.5} color={C.goldText}>ارسال دوباره‌ی کد</T></Press>}
      </View>
    </>
  );
}

export function RenameSheet({ open, onClose, done, current }: SheetProps & { current: string }) {
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setName(current); setError(null); } }, [open, current]);
  const save = async () => {
    if (name.trim().length < 2) { setError('نام باید دست‌کم ۲ حرف باشد.'); return; }
    setBusy(true); setError(null);
    try { await account.rename(name.trim()); done('نام ذخیره شد'); onClose(); }
    catch (e) { setError(errorText(e, 'ذخیره انجام نشد. دوباره تلاش کنید.')); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="ویرایش نام" subtitle="نامی که در حساب و فاکتورها می‌بینید" icon="user">
      <Field label="نام و نام خانوادگی" ltr={false} focused value={name} onChangeText={t => { setName(t); setError(null); }} maxLength={60}
        returnKeyType="done" onSubmitEditing={() => void save()} editable={!busy} />
      {error ? <ErrorBox text={error} /> : null}
      <Cta full label={busy ? 'در حال ذخیره…' : 'ذخیره'} busy={busy} onPress={() => void save()} />
    </Sheet>
  );
}

/** Adds and proves a mobile number (needed for SMS sign-in, password recovery and secure changes). */
export function PhoneSheet({ open, onClose, done }: SheetProps) {
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setPhone(''); setChallenge(null); setError(null); } }, [open]);

  const send = async () => {
    const n = normalizeIranMobile(phone) ?? (challenge ? number : null);
    if (!n) { setError('شماره موبایل را درست وارد کنید؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.'); return; }
    setBusy(true); setError(null);
    try { setChallenge(await account.otpRequest('PHONE_CHANGE', n)); setNumber(n); }
    catch (e) { setError(errorText(e, 'ارسال کد انجام نشد. دوباره تلاش کنید.')); }
    finally { setBusy(false); }
  };
  const verify = async (code: string) => {
    if (!challenge) return;
    setBusy(true); setError(null);
    try {
      const { proof } = await account.otpVerify('PHONE_CHANGE', challenge.challengeId, code);
      await account.setPhone(proof);
      done('شماره‌ی موبایل تأیید شد'); onClose();
    } catch (e) { setError(errorText(e, 'کد درست نیست. دوباره تلاش کنید.').replace('نشست شما تمام شده است. دوباره وارد شوید.', 'کد درست نیست یا منقضی شده است.')); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="تأیید شماره‌ی موبایل" subtitle="کد تأیید یک‌بار برای شما پیامک می‌شود" icon="phone">
      {challenge ? (
        <>
          <CodeStep challenge={challenge} busy={busy} error={error} onCode={v => void verify(v)} onResend={() => void send()} />
          <Press accessibilityRole="button" onPress={() => { setChallenge(null); setError(null); }} style={{ alignSelf: 'center' }}><T w="b" size={12.5} color={C.muted}>ویرایش شماره</T></Press>
        </>
      ) : (
        <>
          <Field label="شماره موبایل" focused value={phone} onChangeText={t => { setPhone(t); setError(null); }} keyboardType="phone-pad" placeholder="0912 345 6789"
            returnKeyType="go" onSubmitEditing={() => void send()} editable={!busy} />
          {error ? <ErrorBox text={error} /> : null}
          <Cta full label={busy ? 'در حال ارسال کد…' : 'دریافت کد تأیید'} busy={busy} onPress={() => void send()} />
        </>
      )}
    </Sheet>
  );
}

export function PasswordSheet({ open, onClose, done, hasPassword, phoneVerified }: SheetProps & { hasPassword: boolean; phoneVerified: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setCurrent(''); setNext(''); setAgain(''); setChallenge(null); setError(null); setShow(false); } }, [open]);

  const submit = async (otpProof?: string) => {
    setBusy(true); setError(null);
    try {
      await account.changePassword({ ...(hasPassword ? { currentPassword: current } : {}), newPassword: next, ...(otpProof ? { otpProof } : {}) });
      done('رمز عبور تغییر کرد'); onClose();
    } catch (e) { setChallenge(null); setError(errorText(e, 'تغییر رمز انجام نشد. دوباره تلاش کنید.')); }
    finally { setBusy(false); }
  };
  const start = async () => {
    if (hasPassword && !current) { setError('رمز عبور فعلی را وارد کنید.'); return; }
    if ([...next].length < 14) { setError('رمز جدید باید دست‌کم ۱۴ کاراکتر باشد؛ یک عبارت ساده و به‌یادماندنی کافی است.'); return; }
    if (next !== again) { setError('رمز جدید و تکرار آن یکسان نیستند.'); return; }
    if (!phoneVerified) { await submit(); return; }
    setBusy(true); setError(null);
    try { setChallenge(await account.otpRequest('REAUTH')); }
    catch (e) { setError(errorText(e, 'ارسال کد انجام نشد. دوباره تلاش کنید.')); }
    finally { setBusy(false); }
  };
  const verify = async (code: string) => {
    if (!challenge) return;
    setBusy(true); setError(null);
    try { const { proof } = await account.otpVerify('REAUTH', challenge.challengeId, code); await submit(proof); }
    catch (e) { setError(errorText(e, 'کد درست نیست.').replace('نشست شما تمام شده است. دوباره وارد شوید.', 'کد درست نیست یا منقضی شده است.')); setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={hasPassword ? 'تغییر رمز عبور' : 'ساخت رمز عبور'} subtitle={phoneVerified ? 'برای امنیت بیشتر، کد پیامکی هم لازم است' : 'رمز تازه جایگزین رمز قبلی می‌شود'} icon="shield">
      {challenge ? (
        <>
          <CodeStep challenge={challenge} busy={busy} error={error} onCode={v => void verify(v)} onResend={() => void start()} />
          <Press accessibilityRole="button" onPress={() => { setChallenge(null); setError(null); }} style={{ alignSelf: 'center' }}><T w="b" size={12.5} color={C.muted}>بازگشت</T></Press>
        </>
      ) : (
        <>
          {hasPassword ? <Field label="رمز عبور فعلی" focused value={current} onChangeText={t => { setCurrent(t); setError(null); }} secureTextEntry={!show} autoComplete="current-password" editable={!busy} /> : null}
          <Field label="رمز عبور جدید (دست‌کم ۱۴ کاراکتر)" focused value={next} onChangeText={t => { setNext(t); setError(null); }} secureTextEntry={!show} autoComplete="new-password" placeholder="یک عبارت ساده و به‌یادماندنی" editable={!busy} />
          <Field label="تکرار رمز جدید" focused value={again} onChangeText={t => { setAgain(t); setError(null); }} secureTextEntry={!show} autoComplete="new-password" returnKeyType="go" onSubmitEditing={() => void start()} editable={!busy} />
          <Press accessibilityRole="button" onPress={() => setShow(v => !v)} style={{ alignSelf: 'flex-end' }}><T w="sb" size={12} color={C.goldText}>{show ? 'پنهان‌کردن رمزها' : 'نمایش رمزها'}</T></Press>
          {error ? <ErrorBox text={error} /> : null}
          <Cta full label={busy ? 'در حال بررسی…' : phoneVerified ? 'ادامه و دریافت کد' : 'ثبت رمز جدید'} busy={busy} onPress={() => void start()} />
        </>
      )}
    </Sheet>
  );
}

/** Two-step sign-in with an authenticator app: set up (secret + first code + recovery codes) or switch off. */
export function TwoFactorSheet({ open, onClose, done, enabled, accountName }: SheetProps & { enabled: boolean; accountName: string }) {
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setSetup(null); setRecovery(null); setCode(''); setError(null); } }, [open]);

  const begin = async () => {
    setBusy(true); setError(null);
    try { setSetup(await account.totpBegin(accountName || 'ZOHALPAY')); }
    catch (e) { setError(errorText(e, 'شروع انجام نشد. دوباره تلاش کنید.')); }
    finally { setBusy(false); }
  };
  const confirm = async (value: string) => {
    setBusy(true); setError(null);
    try { setRecovery((await account.totpConfirm(value)).recoveryCodes); done('ورود دومرحله‌ای فعال شد'); }
    catch (e) { setCode(''); setError(errorText(e, 'کد درست نیست. کد فعلی برنامه را وارد کنید.')); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (code.length !== 6) { setError('کد ۶ رقمی برنامه‌ی تأیید هویت را وارد کنید.'); return; }
    setBusy(true); setError(null);
    try { await account.totpDisable(code); done('ورود دومرحله‌ای خاموش شد'); onClose(); }
    catch (e) { setCode(''); setError(errorText(e, 'کد درست نیست.')); }
    finally { setBusy(false); }
  };

  const mono = { fontFamily: 'monospace' as const, writingDirection: 'ltr' as const, textAlign: 'center' as const };
  return (
    <Sheet open={open} onClose={onClose} title="ورود دومرحله‌ای" subtitle="کد برنامه‌ی تأیید هویت، علاوه بر رمز عبور" icon="shieldS">
      {recovery ? (
        <>
          <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>این کدهای بازیابی را جای امنی نگه دارید؛ اگر برنامه‌ی تأیید هویت را از دست دادید، هر کد یک‌بار ورود شما را باز می‌کند و دوباره نمایش داده نمی‌شود.</T>
          <View style={[{ borderRadius: 16, padding: 12, flexDirection: row, flexWrap: 'wrap', gap: 8, justifyContent: 'center' }, card]}>
            {recovery.map(c => <T key={c} selectable w="b" size={13.5} style={mono}>{c}</T>)}
          </View>
          <Cta full label="کدها را ذخیره کردم" onPress={onClose} />
        </>
      ) : enabled ? (
        <>
          <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>برای خاموش‌کردن، کد فعلی برنامه‌ی تأیید هویت را وارد کنید.</T>
          <CodeBoxes value={code} disabled={busy} invalid={Boolean(error)} onChange={v => { setCode(v); setError(null); }} />
          {error ? <ErrorBox text={error} /> : null}
          <Cta full label={busy ? 'در حال بررسی…' : 'خاموش‌کردن'} busy={busy} disabled={code.length !== 6} onPress={() => void disable()} />
        </>
      ) : setup ? (
        <>
          <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>در برنامه‌ی تأیید هویت (مثل Google Authenticator) یک حساب تازه با این کلید بسازید، سپس کد ۶ رقمی را بنویسید.</T>
          <View style={[{ borderRadius: 16, padding: 14, gap: 6, alignItems: 'center' }, card]}>
            <T size={11} color={C.muted}>کلید برنامه (با نگه‌داشتن انگشت کپی می‌شود)</T>
            <T selectable w="b" size={15} style={mono}>{setup.secret.match(/.{1,4}/g)?.join(' ') ?? setup.secret}</T>
          </View>
          <Press accessibilityRole="button" onPress={() => void Linking.openURL(setup.uri).catch(() => setError('برنامه‌ی تأیید هویت روی این گوشی پیدا نشد؛ کلید بالا را دستی وارد کنید.'))} style={{ alignSelf: 'center' }}>
            <T w="b" size={12.5} color={C.goldText}>باز کردن در برنامه‌ی تأیید هویت</T>
          </Press>
          <CodeBoxes value={code} disabled={busy} invalid={Boolean(error)} onChange={v => { setCode(v); setError(null); if (v.length === 6) void confirm(v); }} />
          {error ? <ErrorBox text={error} /> : null}
        </>
      ) : (
        <>
          <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>با فعال‌کردن آن، ورود به حساب شما بدون کد برنامه‌ی تأیید هویت ممکن نیست؛ حتی اگر رمزتان را کسی بداند.</T>
          {error ? <ErrorBox text={error} /> : null}
          <Cta full label={busy ? 'در حال آماده‌سازی…' : 'شروع فعال‌سازی'} busy={busy} onPress={() => void begin()} />
        </>
      )}
    </Sheet>
  );
}
