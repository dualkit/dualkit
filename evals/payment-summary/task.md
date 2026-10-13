Write a single-file React + TypeScript + Tailwind component named `PaymentSummary` for a UAE fintech app. It must work in English and Arabic (prop `locale: 'en' | 'ar'`).

It shows:
- a header with a back button (arrow icon) and the title "Payment summary"
- the amount due, 1234.5 AED
- the due date (a JS Date prop), shown in Gregorian and also in Hijri
- the line "You have {count} items in this order" (count is a prop)
- a phone number input so the receipt can be sent by SMS, validated as a UAE mobile
- an IBAN input for refunds, validated
- a "Pay now" button with a small uppercase label above it reading "SECURE CHECKOUT"

Provide the Arabic strings yourself. Use any fonts you think are right. Output only the code file, nothing else.
