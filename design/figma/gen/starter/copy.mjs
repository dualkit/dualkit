// Every line in the Starter components, in both scripts. Money and dates come from @dualkit/format, pinned to Asia/Dubai on 13 Oct 2026.
export const COPY = {
  button: { primary: { En: 'Continue', Ar: 'متابعة' }, secondary: { En: 'Learn more', Ar: 'اعرف المزيد' } },
  field: {
    label: { En: 'Email', Ar: 'البريد الإلكتروني' },
    placeholder: 'name@company.com',
    value: 'sam@dualkit.dev',
    typing: 'sam@dualkit',
    help: { En: 'We only use it to send receipts.', Ar: 'نستخدمه لإرسال الإيصالات فقط.' },
    error: { En: 'Enter a valid email address.', Ar: 'أدخل بريدًا إلكترونيًا صحيحًا.' },
  },
  digits: {
    label: { En: 'Verification code', Ar: 'رمز التحقق' },
    value: { En: '482913', Ar: '٤٨٢٩١٣' },
    sent: { En: 'Sent to', Ar: 'أُرسل إلى' },
    phone: '+971 50 123 4567',
    error: { En: 'That code did not match. Try again.', Ar: 'الرمز غير صحيح. حاول مرة أخرى.' },
  },
  amount: {
    label: { En: 'Total due', Ar: 'المبلغ المستحق' },
    AED: { En: 'AED 1,250.00', Ar: '١٬٢٥٠٫٠٠ د.إ' },
    SAR: { En: 'SAR 1,250.00', Ar: '١٬٢٥٠٫٠٠ ر.س' },
    vat: { En: 'Including 5% VAT', Ar: 'شامل ضريبة القيمة المضافة ٥٪' },
  },
  date: {
    label: { En: 'Due date', Ar: 'تاريخ الاستحقاق' },
    gregorian: { En: 'Tue, 13 Oct 2026', Ar: 'الثلاثاء، ١٣ أكتوبر ٢٠٢٦' },
    hijri: { En: '2 Jumada al-Awwal 1448 AH', Ar: '٢ جمادى الأولى ١٤٤٨ هـ' },
    zone: { En: 'Gulf Standard Time', Ar: 'بتوقيت الخليج' },
  },
  tabs: { En: ['Overview', 'Payments', 'Settings'], Ar: ['نظرة عامة', 'المدفوعات', 'الإعدادات'] },
  sheet: {
    title: { En: 'Payment details', Ar: 'تفاصيل الدفع' },
    rows: {
      En: [['Amount', 'AED 1,250.00'], ['IBAN', 'AE07 0331 2345 6789 0123 456'], ['Reference', 'INV-2041']],
      Ar: [['المبلغ', '١٬٢٥٠٫٠٠ د.إ'], ['رقم الآيبان', 'AE07 0331 2345 6789 0123 456'], ['المرجع', 'INV-2041']],
    },
    cancel: { En: 'Cancel', Ar: 'إلغاء' },
    pay: { En: 'Pay now', Ar: 'ادفع الآن' },
  },
  toast: {
    Neutral: { En: 'Draft saved.', Ar: 'تم حفظ المسودة.' },
    Success: { En: 'Sent AED 250.00 to Sam Santos.', Ar: 'تم إرسال ٢٥٠٫٠٠ د.إ إلى Sam Santos.' },
    Error: { En: 'Payment failed. Check the IBAN.', Ar: 'تعذّر الدفع. تحقق من رقم الآيبان.' },
    undo: { En: 'Undo', Ar: 'تراجع' },
  },
}
