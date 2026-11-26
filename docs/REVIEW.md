# Content review: sources, Arabic, history

Carried out on 26 November 2026, before launch, following the accuracy rules in GDD §3 and §14. This records what was
checked, how, what changed, and what still needs a credentialed human reviewer.

## 1. Ghazali passages, checked against the Arabic

**Method.** The relevant books of the *Ihya' 'Ulum al-Din* were downloaded page by page from al-Maktaba al-Shamila
(book 9472: Dar al-Ma'rifa, Beirut, 4 vols, with al-'Iraqi's *takhrij*), along with *al-Mustasfa* (book 5459, ed.
Muhammad 'Abd al-Salam 'Abd al-Shafi, Dar al-Kutub al-'Ilmiyya). The books downloaded were 1 (Knowledge), 13 (Earning
and Living), 14, 19 (Commanding Right), 26 (Condemnation of the World), 32 (Patience and Thankfulness), and the
*istislah* section of *al-Mustasfa*. Each passage was searched for with vowel marks stripped. The exact wording was
then copied from the source text, never retyped. Volume and page numbers are the printed ones Shamela records.
`npm run quotes:verify` (`scripts/content/verify_ghazali.py`) repeats the check automatically, and the tests require
every Arabic quote to carry a verified status and a page link.

| Codex entry | Passage | Citation | Result |
| --- | --- | --- | --- |
| needle-hands | The needle "passes through the hand of the needle-maker twenty-five times, doing a task each time" | *Ihya'* 4:119 | **Corrected.** The GDD said "about 25 hands". It is 25 operations by one craftsman. |
| needle-hands (summary) | The chain baker, miller, ploughman, smith, carpenter, ruler | 4:120 | Added; it mirrors the game's production chains |
| money-mirror | Dinars and dirhams created as "judges and intermediaries between all goods"; money "like a mirror, no colour of its own, shows every colour"; hoarding wrongs it | 4:91 | Confirmed; Arabic added |
| money-mirror (counterfeit) | Passing false dirhams is injustice that spreads from hand to hand | 2:73–74 | Confirmed; citation added (it was misattributed to Book 32) |
| root-crafts | "Roots without which the world cannot stand… four: agriculture, weaving, building, governance" | 1:12–13 | **Confirmed.** "Passage to be confirmed" removed. (A shorter list in 1:16 omits building.) |
| markets-from-need | Farmer, smith and carpenter; barter blocked; shops and storehouses, "and so markets appeared"; merchants; then coin and the mint | 3:227–228 | **Corrected source.** It is Book 26 (*Dhamm al-Dunya*), not Book 32. |
| ihtikar | "The food seller who stores food, waiting for prices to rise: a general injustice" | 2:72 | Confirmed |
| honest-trade | The four rules (no false praise, no hidden defects, no concealment in weight or price); "justice… plays the part of capital, benevolence… of profit" | 2:75, 2:79 | Confirmed; the quote is now the justice/benevolence passage |
| hisba | A wrong is the muhtasib's business only if "apparent without spying" | 2:325 (also 2:338) | Confirmed |
| five-protections | "The purpose of the Law for creation is five: religion, life, intellect, lineage, property" | *al-Mustasfa* p. 174 | Confirmed word for word |
| three-needs | Maslaha divides into the ranks of *ḍarūrāt*, *ḥājāt*, *taḥsīnāt* | *al-Mustasfa* p. 174 | Confirmed. The adjectival forms *daruriyyat/hajiyyat/tahsiniyyat* are later (al-Shatibi) usage. |
| two-finance-paths | Usury forbidden; the *qirad* (mudaraba) contract | *Ihya'* 2:64–71 (Book 13, ch. 2) | **Corrected citation** (it said Book 14) |

Every Ghazali entry now shows the Arabic original with our own English translation, as §3 and §16 require. Modern
translations were not copied. One event line (the Scholar on coinage) now uses the verified wording. The GDD has a
dated source-check note listing these corrections.

**Still open:** cross-check the same pages against the **Dar al-Minhaj** critical edition (Jeddah, 2011), which is the
GDD's reference text and is not online. When a passage has been checked there, set its `status` to
`"verified-edition"`.

## 2. Arabic interface text

All 470+ interface strings and every Arabic field in the 43 event cards and 22 codex entries were read line by line.

| Problem | Example | Fix |
| --- | --- | --- |
| Ambiguous word: unvowelled حب reads as "love" | حَبّ (grain), 30+ places | القمح (wheat). Masculine singular like the original, so agreement holds; and historically right for the Corn Laws. |
| Wrong modern meaning | المعلّمون for master craftsmen reads "teachers" | أرباب الحِرف; أصحاب المصانع in factory contexts |
| Ambiguous status word | قائمة ("established") reads as "list" | تأسّست |
| Archaic, religiously loaded tax word | مكس/مكوس for excise and tolls | ضريبة الاستهلاك; رسوم المرور |
| "Download" for "load" | تحميل لعبة محفوظة | فتح لعبة محفوظة |
| Grammar | تُعاد بناؤها; يتسوّى التجار; قامت {name} (forced gender); وعُرفت (no subject) | يُعاد بناؤها; يسوّي التجار حساباتهم; تأسيس «{name}»; وعُرفت الحادثة |
| Typo | ينسّاجون | نسّاجون |
| Inconsistent imperative | احتكموا (plural) among singular choices | أحِل النزاع إلى قاضٍ |
| Awkward names | محطّة حطب, حدّادة, نسّاج (for a workshop), نورِتش | مَحطَبة, ورشة حدادة, ورشة نسيج, نوريتش |
| Terminology | المخالفين (English Dissenters) | المنشقّين عن الكنيسة |
| Plural forms | `turnsCover` lacked Arabic `zero` | Added |

The English and Arabic locales are now checked for identical keys by `tests/sim/content.test.ts`.

**Still open:** a native Arabic editor should do a final read for style and tone in context, in the running game.
These fixes remove the errors that would mislead or confuse a reader.

## 3. History notes and real-world examples

All 16 history notes on event cards and the codex's real-world examples were checked. Two figures were spot-checked
against sources: the American war's addition to the debt, and Peterloo.

| Claim | Verdict |
| --- | --- |
| East India Company lost the India monopoly 1813, China 1833 | Correct. Smith's attack is in **Books IV and V**, not IV alone; fixed. |
| Hargreaves' jenny c. 1764 (8 spindles); Arkwright's water frame 1769 | Correct |
| Boulton & Watt's first engines 1776; about a quarter of a Newcomen engine's fuel | Correct |
| Luddites 1811–16, beginning with Nottinghamshire framework knitters | Correct |
| Bridgewater Canal 1761 halved Manchester coal prices; canal mania in the 1790s | Correct |
| Eden Treaty 1786, ended by war 1793 | Correct |
| Test and Corporation Acts: repeal defeated 1787, 1789, 1790; repealed 1828 | Correct |
| American war "added roughly £100 million" | Sharpened: debt rose from about £127m to about £240m by 1783, so **more than £100m** |
| Pitt's sinking fund 1786 | Correct |
| Bank Restriction February 1797 (after the Fishguard landing), until 1821 | Correct |
| Income tax 1799, abolished 1816, Peel 1842 | Correct |
| Continental System 1806; Orders in Council in reply | Correct |
| Corn Law 1815: no wheat imports below 80s a quarter; repealed 1846 | Correct |
| Peterloo 1819: about 60,000 present, at least 15 killed; Reform Act 1832 | Correct (most sources give 15–18 deaths) |
| Factory Act 1833: no children under 9 in textile mills; inspectors | Correct |
| Railway mania peaked 1846 | Correct |
| Henry VIII's debasement "cut silver to a third" | **Corrected** to "from 92.5% to about 25%" |
| South Korea "saved over 30% of GDP for decades as it industrialised" | **Corrected:** under 10% in the early 1960s, over 30% from the late 1980s |
| Ford assembly line 1913 (12.5 h to about 1.5 h); container shipping 1956; POW cigarette money; Ayr Bank 1772; Philip II's four defaults; Scotland's 1696 schools act; Metre Convention 1875 | Correct |

Spot-check sources: [Econlib, history of the English debt](https://www.econlib.org/book-chapters/chapter-bk-vch-iii/),
[Financial costs of the American Revolutionary War](https://en.wikipedia.org/wiki/Financial_costs_of_the_American_Revolutionary_War),
[Peterloo Massacre](https://wikipedia.com/wiki/Peterloo),
[Warwick Modern Records Centre on Peterloo](https://warwick.ac.uk/services/library/mrc/exhibitions/exhibitionsonline/regency/peterloo).

**Still open:** an economic historian should review the calibration and starting estimates (Britain's 1776 literacy
of 45% and population of about 12 million are labelled estimates), as GDD §3 requires before launch.

## Rechecking

```sh
npm run quotes:verify   # Smith vs Gutenberg; Ghazali vs Shamela
npm test                # includes the citation, status and locale-parity checks
```
