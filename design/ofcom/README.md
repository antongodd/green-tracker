# Green Tracker and the Online Safety Act: Anton's paperwork

> **This is not legal advice.** Claude drafted these papers from Ofcom's published guidance (as far as it could be
> checked, see below) and from what the app really does on 3 November 2026. They are a starting point for Anton to
> read, correct and keep. If Ofcom ever writes to you, or the app grows a lot, get advice from a solicitor who
> knows the Online Safety Act.

## What's here

| File | What it is | Ofcom's name for it |
|---|---|---|
| [`illegal-content-risk-assessment.md`](illegal-content-risk-assessment.md) | How likely each kind of illegal content is on Green Tracker, how bad it would be, what the app already does, and what more could be done. Includes the record Ofcom expects. | Illegal content risk assessment (and its record) |
| [`childrens-access-assessment.md`](childrens-access-assessment.md) | Can children use Green Tracker, and are they likely to? Then whether a children's risk assessment is needed (it isn't, for now, and it says why). | Children's access assessment |

## Why Green Tracker has to do this

Anton ran Ofcom's online checker (2026-11-03) and it said the Online Safety Act applies. Since posts and comments
(D77, 2026-11-02), people on Green Tracker share things with each other, so it's a **user-to-user service**. The Act
applies however small or free a service is. Every user-to-user service must:

1. write an **illegal content risk assessment** and keep a record of it;
2. write a **children's access assessment** and keep a record of it;
3. take sensible steps against the risks it finds (Ofcom's Codes of Practice list them), and keep those up to date.

The first deadlines (March and April 2025) were before Green Tracker had posts. A service that becomes user-to-user
later has to do the assessments when it does. Ofcom's own wording on how soon is one of the points to check 🔎 (it
gave existing services three months the first time round). Posts went live on 2026-11-02, so finishing these now,
straight after, is the right thing to do.

## What Anton must still do himself

These can't be done by Claude:

1. **Read both papers.** Change anything that isn't true. You know your users better than the code does.
2. **Fill in the blanks** marked ✍️: your full name as the person responsible, today's date, and how many accounts
   there are (ask a conversation for the account audit; it shows the number without saving it).
3. **Sign and date them** (typing your name and the date at the end is enough), and **keep a copy** somewhere safe
   outside the app: for example a PDF in your own Drive or email. Ofcom can ask to see them. Keep each old copy when
   you make a new one (Ofcom expects past versions to be kept too).
4. **Put two dates in your calendar:**
   - **3 November 2027**, the latest date to look at both papers again (once a year, at least);
   - a reminder that **before any big change** that changes what people can share with each other (messages, groups,
     public posts, links, video, a public search, opening it to everyone), the papers are looked at again first. The
     `big-change` recipe now reminds Claude of this too.
5. **Check reports regularly** (say, once a week: "show me the reports"), and act on them quickly. The papers rely on
   this. See the new to-do item 13.
6. **Check the points marked 🔎 on Ofcom's own site.** Ofcom's website (ofcom.org.uk) couldn't be opened from the
   cloud computer Claude works on, so some details come from law firms' summaries of Ofcom's guidance and from what
   Claude already knew. Those are marked 🔎. The main conclusions don't depend on them, but the exact wording might.
   The pages to look at are listed under "Sources".
7. **Optional:** Ofcom has a free record-keeping template (a Word file, linked under Sources). If you'd rather keep the
   record in Ofcom's own format, these papers have everything needed to fill it in.

## Gaps found (on the to-do list, not built)

- **To-do 13, acting on reports:** reports only reach you when you ask; there's no way yet to close an account
  that keeps breaking the rules (the house rules say you can); and the house rules don't say how to complain about a
  decision. Ofcom expects reports to be dealt with quickly and complaints to have a route.
- **To-do 14, a stronger age check (your choice, later):** the "I'm 18 or over" tick isn't what Ofcom calls *highly
  effective age assurance*, so in law children *can* use the app. That's fine for now (see the children's paper),
  but if Green Tracker opens up to strangers beyond friends, a proper age check would be the safe step.

## Sources

Ofcom (could **not** be opened from here on 2026-11-03; read them yourself, 🔎):

- Risk assessment guidance and Risk Profiles (illegal content):
  https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/updates/risk-assessment-guidance-and-risk-profiles.pdf
- Record-keeping and review guidance:
  https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/updates/record-keeping-and-review-guidance.pdf
- Record-keeping template: https://ofcom.org.uk/siteassets/online-safety/documents/illegal-content-duties-record-keeping-template.docx
- Check how to comply with the illegal content rules (the tool):
  https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/check-how-to-comply-with-the-illegal-content-rules/
- Children's access assessments, quick guide:
  https://www.ofcom.org.uk/online-safety/information-for-industry/guide-for-services/quick-guide-to-childrens-access-assessments
- Children's access assessment tool: https://www.ofcom.org.uk/os-toolkit/child-access-assessment/childrens-access-assessment-tool
- Statement on protecting children from harms online (April 2025):
  https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/statement-protecting-children-from-harms-online
- All of Ofcom's online safety documents: https://www.ofcom.org.uk/online-safety/online-safety-regulatory-documents

Summaries that could be read (search results, 2026-11-03):

- Pinsent Masons, children's access assessments: https://www.pinsentmasons.com/out-law/news/online-platforms-face-child-access-assessment-deadline-april
- Cooley, age assurance and children's access: https://uklitigation.cooley.com/uk-online-safety-act-age-assurance-and-childrens-access-statement/
- Osborne Clarke, Ofcom's final illegal content guidance: https://www.osborneclarke.com/insights/ofcom-publishes-final-illegal-content-risk-assessment-guidance-and-codes-practice-under-uk
- RPC, Ofcom's children's codes and risk assessment guidance: https://www.rpclegal.com/snapshots/technology-digital/summer-2025/ofcom-publishes-childrens-online-safety-codes-and-risk-assessment-guidance/
- IFTAS, small services and the Act: https://about.iftas.org/2025/07/30/navigating-the-uk-online-safety-act/

What the app does: `SPEC.md` (D23, D47, D77, D78, D80, D83, D84), `client/src/screens/About.tsx` (privacy page and
house rules), `shared/domain/trust.ts` (report reasons), `server/routes/people.ts` and `posts.ts`,
`reviews/2026-11-03/sceptical-investor.md`, the website `site/public/index.html`.
