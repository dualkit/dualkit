// Copy for /components/gulf. The Arabic sits under `ar` keys so the copy test can find it.

export const GULF_SLUGS = ['gulf-phone-input', 'gulf-iban-input', 'gulf-national-id-input', 'gulf-amount', 'gulf-hijri-date'] as const
export type GulfSlug = (typeof GULF_SLUGS)[number]

export const gulfInstall = (slug: GulfSlug): string => `npx shadcn@latest add https://dualkit.dev/r/${slug}.json`

export const GULF_COPY = {
  title: 'Gulf components',
  description: 'Five shadcn inputs for Gulf phones, IBANs, Emirates IDs, amounts and Hijri dates, built on @dualkit/format.',
  heading: 'Gulf components',
  lede: 'Five inputs for the shadcn registry. They use your shadcn theme and primitives, and every check comes from @dualkit/format.',
  setup: 'Each one installs into components/gulf with the shadcn CLI, along with Input, Label and a shared field file. They work with and without shadcn init --rtl. All labels, help text and error messages come in as props.',
  contract: 'Each takes a controlled value and onChange, and onResult hands you the result from format: { ok: true, value } or { ok: false, error: { code, message } }.',
  english: 'English',
  arabic: 'Arabic',
  result: 'onResult',
  waiting: 'Type to see the result.',
  items: {
    'gulf-phone-input': {
      name: 'Phone input',
      line: 'A number from any of the six GCC countries. It reads Arabic-Indic digits, returns E.164 and stays left to right in Arabic.',
      en: { label: 'Mobile number', country: 'Country code', help: 'Pick the country, then type the number.', errors: { invalid_length: 'This number is too short or too long.', unknown_prefix: 'Check how the number starts.', not_gulf: 'Use a GCC number.' } },
      ar: { label: 'رقم الجوال', country: 'رمز الدولة', help: 'اختر الدولة ثم اكتب الرقم.', errors: { invalid_length: 'عدد الأرقام غير صحيح.', unknown_prefix: 'تحقق من أول الأرقام.', not_gulf: 'استخدم رقمًا خليجيًا.' } },
    },
    'gulf-iban-input': {
      name: 'IBAN input',
      line: 'Groups the IBAN in fours as you type, and checks the length and checksum for each Gulf country.',
      en: { label: 'IBAN', help: 'Spaces are added for you.', errors: { invalid_length: 'This IBAN has the wrong length.', invalid_checksum: 'This IBAN is not valid. Check for a typo.', unsupported_country: 'Use a Gulf IBAN.' } },
      ar: { label: 'رقم الآيبان', help: 'تُضاف المسافات تلقائيًا.', errors: { invalid_length: 'طول رقم الآيبان غير صحيح.', invalid_checksum: 'رقم الآيبان غير صحيح. تحقق منه.', unsupported_country: 'استخدم رقم آيبان خليجيًا.' } },
    },
    'gulf-national-id-input': {
      name: 'National ID input',
      line: 'An Emirates ID number, hyphenated as you type and checked against the 784 prefix and the check digit. Saudi ID and Iqama come once format can check them.',
      en: { label: 'Emirates ID', help: '15 digits, starting with 784.', errors: { invalid_length: 'An Emirates ID has 15 digits.', invalid_prefix: 'An Emirates ID starts with 784.', invalid_checksum: 'This number is not valid. Check for a typo.' } },
      ar: { label: 'رقم الهوية الإماراتية', help: '١٥ رقمًا تبدأ بـ ٧٨٤.', errors: { invalid_length: 'رقم الهوية ١٥ رقمًا.', invalid_prefix: 'رقم الهوية يبدأ بـ ٧٨٤.', invalid_checksum: 'رقم الهوية غير صحيح. تحقق منه.' } },
    },
    'gulf-amount': {
      name: 'Amount',
      line: 'An amount in AED, SAR, QAR, KWD, BHD or OMR. Dinars and rials take three decimals. English puts the code first and Arabic puts the abbreviation after the number.',
      en: { label: 'Amount', help: 'Up to three decimals for KWD.', errors: { too_many_decimals: 'KWD has three decimals.', invalid_number: 'Use digits only.' } },
      ar: { label: 'المبلغ', help: 'حتى ثلاث خانات عشرية للدينار الكويتي.', errors: { too_many_decimals: 'الدينار الكويتي له ثلاث خانات عشرية.', invalid_number: 'استخدم الأرقام فقط.' } },
    },
    'gulf-hijri-date': {
      name: 'Hijri date',
      line: 'Type a date once and see it in Gregorian and Umm al-Qura Hijri side by side. The time zone is required.',
      en: { label: 'Start date', help: 'Write it as YYYY-MM-DD.', gregorian: 'Gregorian', hijri: 'Hijri', errors: { invalid_format: 'Write the date as YYYY-MM-DD.', invalid_date: 'This date does not exist.' } },
      ar: { label: 'تاريخ البدء', help: 'السنة-الشهر-اليوم.', gregorian: 'ميلادي', hijri: 'هجري', errors: { invalid_format: 'اكتب التاريخ بصيغة السنة-الشهر-اليوم.', invalid_date: 'هذا التاريخ غير موجود.' } },
    },
  },
} as const
