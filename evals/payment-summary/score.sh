f=$1
y(){ if grep -qE "$2" $f; then r=PASS; else r=FAIL; fi; [ "$3" = neg ] && { [ $r = PASS ] && r=FAIL || r=PASS; }; printf "  %-50s %s\n" "$1" $r; }
echo "== $f"
y "F1 LTR runs isolated in Arabic (bdi / U+2066)" 'bdi|\\u2066|⁦'
y "F2 timeZone passed to date formatting" 'timeZone'
y "F3 digits pinned (nu- or numerals option or lib)" 'nu-latn|nu-arab|numerals:|formatMoney|formatHijri'
y "F4 typed digits normalised" 'toWesternDigits|parseUaePhone|\[٠-٩'
y "F5 Arabic line-height/size/tracking override" 'lang\(ar\)|leading-\[1\.[6-8]|line-?[hH]eight|size-adjust|rtl:tracking-normal|tracking-normal'
y "F6 Arabic zero plural" 'zero:'
y "F7 caps not stored in strings" "'SECURE CHECKOUT'|\"SECURE CHECKOUT\"" neg
y "physical ml/mr/left/right classes absent" '\b(ml|mr|pl|pr)-[0-9]|\b(left|right)-[0-9]|text-(left|right)\b' neg
