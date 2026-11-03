# Disclosure and calendar checks for listed companies

This system checks your own investor records against the rules and limits below and lists what is missing, late or out of line. It does not decide what is market sensitive, replace your continuous disclosure policy or your disclosure officer, and it is not legal advice. Each number lives in the `settings` table (`/settings`, `/setting`), so you set it from your own policy and your own market.

The ASX quotes below were read from the ASX Listing Rules chapters and Guidance Note 8 (27 May 2024 version) on asx.com.au. The Corporations Act references are to the Corporations Act 2001 (Cth) on legislation.gov.au. Check the current text before you rely on a number: rules change.

## The rules the checks run

### MATERIAL-NOT-RELEASED: material shown before it went to the market

- **Source.** ASX Listing Rule 15.7: "An entity must not release information that is for release to the market to any person until it has given the information to ASX and has received an acknowledgement that ASX has released the information to the market." ASX Guidance Note 8, section 7.7 (Analyst and investor briefings): "It is prudent practice for an entity to ensure that any new presentation to be given to, or printed materials to be handed out at, an analyst or investor briefing are first given to ASX and published on MAP before the briefing."
- **In the data.** A meeting (held or booked, not cancelled) whose `material` has no `released_on`, or a `released_on` after the meeting date.
- **Note.** Guidance Note 8 accepts that a series of presentations with materially the same information, tailored for each meeting, need not each go to the market. Record one material for the series and release it once.

### BLACKOUT-MEETING: an investor meeting inside a blackout

- **Source.** Your own continuous disclosure or communications policy. Many listed companies stop one-on-one investor meetings between the period end and the result, and before a quarterly. Guidance Note 8, section 7.7, explains why: "Analyst and investor briefings ... require particular care to avoid the selective disclosure of market sensitive information."
- **In the data.** A one-on-one, group, call or site visit (not cancelled) dated inside a window from `blackout_lead_days` before the period end of an event marked `blackout`, to that event's date.
- **Setting.** `blackout_lead_days` (0 by default). Mark which events start a blackout with `--blackout` when you add them.

### NOTES-NOT-WRITTEN: no record of what was said

- **Source.** Guidance Note 8, section 7.7: "An entity should, as a matter of practice, review proceedings at analyst and investor briefings, including responses provided to any questions asked at the briefing, shortly afterwards to verify that no market sensitive information has been inadvertently disclosed." You cannot review a meeting nobody wrote down.
- **In the data.** A held meeting with no notes after `notes_due_days` (2 by default, a house setting).

### SUBSTANTIAL-NOTICE: a holding the register says needs a notice

- **Source.** Corporations Act s671B: a person must give a notice when they begin or cease to have a substantial holding, or when a substantial holding moves by at least 1 percentage point, and for a listed company generally within 2 business days. A substantial holding is 5% or more of the voting power (s9).
- **In the data.** An institution at or over `substantial_bps` (500 = 5%) on the latest register with no notice on file, or one that has moved `movement_bps` (100 = 1 point) or more since its last notice; or one below 5% whose last notice still says it is substantial.
- **Note.** The duty is the holder's, not the company's. This check tells the IR team which holders to watch for, and which notices to read when they land. The register date and the notice date are not the same as the trade date, so treat a finding as a question, not a breach.

### AGM-NOTICE and AGM-DEADLINE

- **Source.** Corporations Act s249HA: at least 28 days' notice of a meeting of a listed company. Corporations Act s250N(2): a public company must hold an AGM within 5 months after the end of its financial year.
- **In the data.** The AGM event's `notice_sent_on` less than `agm_notice_days` (28) before the meeting; the AGM dated after the year end (`period_end`) plus `agm_due_months` (5).

### RESULTS-DEADLINE: half-year and preliminary final reports

- **Source.** ASX Listing Rule 4.3B: the preliminary final report (Appendix 4E) goes to ASX "no later than the time that it lodges any accounts with ASIC ... It must do so in any event no later than two months after the end of the accounting period." ASX Listing Rule 4.2B: the half-year report goes to ASX "no later than the time that it lodges any accounts with ASIC". Corporations Act s320 sets the half-year lodgement at 75 days after the half.
- **In the data.** A full-year results event lodged (or planned) after `period_end` plus `preliminary_due_months` (2), or a half-year after `period_end` plus `half_year_due_days` (75).

### QUARTERLY-DEADLINE

- **Source.** ASX Listing Rule 4.7B: an entity required to give an Appendix 4C must give it "in any event within 1 month after the end of each quarter of its financial year". ASX Listing Rule 5.1: a mining producing entity must give its quarterly report "no later than 1 month after the end of the quarter".
- **In the data.** A quarterly event lodged (or planned) after `period_end` plus `quarterly_due_months` (1).

## Listed on NZX instead

The checks are the same shape; the numbers are different. Set them from the NZX Listing Rules and the Financial Markets Conduct Act 2013 (substantial product holder disclosure) and the Companies Act 1993 (annual meeting timing), then change the settings to match. This repository does not ship NZ numbers it has not checked against the current text.

## House settings

- `quiet_days` and `quiet_min_bps`: which holders show as gone quiet.
- `coverage_stale_days`: when a broker note counts as stale.
- `follow_up_days`: the default due date for a promise made in a meeting.
