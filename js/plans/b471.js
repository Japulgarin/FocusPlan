import { DEFAULT_TEMPLATE } from "../schedule.js";

const EXAM_DAY_SEGMENTS = [
  { type: "wake",  label: "Wake, light breakfast, no new content", start: "08:00", end: "08:30", taskBlock: 0 },
  { type: "study", blockNum: 1, start: "08:30", end: "09:30" },
  { type: "other", label: "Travel early, arrive, stay calm", start: "09:30", end: "10:00", taskBlock: 2 }
];

export const B471_PLAN = {
  id: "b471",
  name: "B471 Competitive Strategy — Exam Countdown",
  icon: "🎓",
  subtitle: "Example plan · Exam: Tuesday, September 29, 2026",
  color: "#5b8cff",
  source: "builtin",
  startDate: "2026-09-23",
  endDate: "2026-09-29",
  template: DEFAULT_TEMPLATE,
  days: [
    {
      date: "2026-09-23", label: "Topic 1 + Topic 2",
      blocks: [
        { title: "Blocks 1–3 · Topic 1: Introduction", short: "Topic 1: Introduction", blockNums: [1,2,3], tasks: [
          "Read Topic 1 — Introduction",
          "Key question: what explains heterogeneity in firm performance? (ext. vs. internal factors)",
          "3 strategy levels: Corporate / Competitive / Functional — ex: Bosch Group",
          "Deliberate vs. Emergent strategy"
        ]},
        { title: "Blocks 4–7 · Topic 2: Five Forces", short: "Topic 2: Five Forces", blockNums: [4,5,6,7], tasks: [
          "Read Topic 2 — Five Forces",
          "Name all 5 forces + complementors",
          "Buyer power vs. supplier power conditions",
          "Ex: European airline industry (producers/customers/suppliers/substitutes)"
        ]},
        { title: "Blocks 8–11 · Wrap-up", short: "Wrap-up: Summary Sheet 1 & 2", blockNums: [8,9,10,11], tasks: [
          "Summary Sheet — Topic 1 & 2",
          "Flashcards for key terms"
        ]}
      ]
    },
    {
      date: "2026-09-24", label: "Topic 3 + Topic 4",
      blocks: [
        { title: "Blocks 1–4 · Topic 3: Strategic Groups & Industry Life-Cycle", short: "Topic 3: Strategic Groups & ILC", blockNums: [1,2,3,4], tasks: [
          "Read Topic 3 — Strategic Groups & Industry Life-Cycle",
          "5 ILC stages: Embryonic → Growth → Shakeout → Mature → Decline",
          "Ex: mobile phone industry evolution; iPhone (2007) crossing the chasm",
          "Deter-entry / manage-rivalry strategies + 4 decline strategies — ex: tobacco (slow decline)"
        ]},
        { title: "Blocks 5–8 · Topic 4: Internal Analysis", short: "Topic 4: Internal Analysis (VRIO)", blockNums: [5,6,7,8], tasks: [
          "Read Topic 4 — Internal Analysis",
          "VRIO: Valuable? Rare? Inimitable? Organized?",
          "3 imitation barriers: history, causal ambiguity, social complexity",
          "Value formula V–P–C — ex: Apple vs. Samsung"
        ]},
        { title: "Blocks 9–11 · Wrap-up", short: "Wrap-up: Summary Sheet 3 & 4", blockNums: [9,10,11], tasks: [
          "Summary Sheet — Topic 3 & 4",
          "Flashcards for VRIO + ILC terms"
        ]}
      ]
    },
    {
      date: "2026-09-25", label: "Topics 5, 6, 7 + logistics + problem sets — finish all slides tonight",
      blocks: [
        { title: "Blocks 1–2 · Topic 5: Strategy Development & Implementation", short: "Topic 5: Strategy Development", blockNums: [1,2], tasks: [
          "Read Topic 5 — Strategy Development",
          "7 cost-advantage sources + 7 differentiation-advantage sources",
          "'Stuck in the middle' — ex: Apple (differentiation + decentralization)"
        ]},
        { title: "Blocks 3–4 · Topic 6: Strategy & Technology", short: "Topic 6: Strategy & Technology", blockNums: [3,4], tasks: [
          "Read Topic 6 — Strategy & Technology",
          "6 business model types — ex: Ryanair",
          "High-tech cost structure — ex: Company α vs. β; Technology S-curve"
        ]},
        { title: "Block 5 · Topic 7: Exam Information", short: "Topic 7: Exam Info", blockNums: [5], tasks: [
          "Exam structure: SC / fill-in / open questions",
          "Logistics: closed-book, dictionary + calculator OK, date 29.09.2026"
        ]},
        { title: "Block 6 · Events", short: "Events", blockNums: [6], tasks: [
          "Check for any exam-relevant dates/sessions"
        ]},
        { title: "Blocks 7–9 · Problem sets (first read only, don't solve yet)", short: "Problem Sets — first read", blockNums: [7,8,9], tasks: [
          "Read Problem Set 1, map questions to topics",
          "Read Problem Set 2, map questions to topics"
        ]},
        { title: "Blocks 10–11 · Wrap-up", short: "Wrap-up: Summary Sheet 5, 6, 7", blockNums: [10,11], tasks: [
          "Summary Sheet — Topic 5, 6, 7",
          "Checkpoint: all 7 topics covered once"
        ]}
      ]
    },
    {
      date: "2026-09-26", label: "Deep review Topics 1–4 + Problem Set 1",
      blocks: [
        { title: "Blocks 1–2 · Active recall — Topics 1 & 2", short: "Recall: Topics 1 & 2", blockNums: [1,2], tasks: [
          "Recall Topic 1 & 2 from memory, mark gaps"
        ]},
        { title: "Blocks 3–4 · Active recall — Topics 3 & 4", short: "Recall: Topics 3 & 4", blockNums: [3,4], tasks: [
          "Recall Topic 3 & 4 from memory, mark gaps"
        ]},
        { title: "Blocks 5–7 · Problem Set 1", short: "Problem Set 1 (timed)", blockNums: [5,6,7], tasks: [
          "Solve Problem Set 1 timed, unaided",
          "Grade + note missed concepts"
        ]},
        { title: "Blocks 8–9 · Fix gaps", short: "Fix gaps — Topics 1–4", blockNums: [8,9], tasks: [
          "Redo every gap from Topics 1–4 until solid"
        ]},
        { title: "Blocks 10–11 · Rebuild sheets", short: "Rebuild Summary Sheets 1–4", blockNums: [10,11], tasks: [
          "Rebuild Summary Sheets 1–4"
        ]}
      ]
    },
    {
      date: "2026-09-27", label: "Deep review Topics 5–7 + Problem Set 2",
      blocks: [
        { title: "Blocks 1–2 · Active recall — Topic 5", short: "Recall: Topic 5", blockNums: [1,2], tasks: [
          "Recall Topic 5 from memory, mark gaps"
        ]},
        { title: "Blocks 3–4 · Active recall — Topics 6 & 7", short: "Recall: Topics 6 & 7", blockNums: [3,4], tasks: [
          "Recall Topic 6 & 7 from memory, mark gaps"
        ]},
        { title: "Blocks 5–7 · Problem Set 2", short: "Problem Set 2 (timed)", blockNums: [5,6,7], tasks: [
          "Solve Problem Set 2 timed, unaided",
          "Grade + note missed concepts"
        ]},
        { title: "Blocks 8–9 · Fix gaps", short: "Fix gaps — Topics 5–7", blockNums: [8,9], tasks: [
          "Redo every gap from Topics 5–7 until solid"
        ]},
        { title: "Blocks 10–11 · Rebuild sheets", short: "Rebuild Summary Sheets 5–7", blockNums: [10,11], tasks: [
          "Rebuild Summary Sheets 5–7"
        ]}
      ]
    },
    {
      date: "2026-09-28", label: "Full mock exam + weak-spot triage",
      blocks: [
        { title: "Blocks 1–3 · Full mock exam", short: "Full mock exam", blockNums: [1,2,3], tasks: [
          "Timed mock exam — both problem sets, exam conditions"
        ]},
        { title: "Block 4 · Grade", short: "Grade & rank weak topics", blockNums: [4], tasks: [
          "Grade honestly, rank weak topics"
        ]},
        { title: "Blocks 5–9 · Targeted review", short: "Targeted review of weak topics", blockNums: [5,6,7,8,9], tasks: [
          "Deep review weakest topic first, then the rest"
        ]},
        { title: "Blocks 10–11 · Final prep", short: "Final prep & pack", blockNums: [10,11], tasks: [
          "Full pass through all 7 Summary Sheets",
          "Pack materials, confirm exam time/room"
        ]}
      ]
    },
    {
      date: "2026-09-29", label: "EXAM DAY — confidence pass only, no new content", segments: EXAM_DAY_SEGMENTS,
      blocks: [
        { title: "Wake & breakfast", short: "Wake & breakfast", blockNums: [], tasks: [
          "Wake, light breakfast, no new content"
        ]},
        { title: "Confidence pass", short: "Confidence pass", blockNums: [1], tasks: [
          "Calm pass through all 7 Summary Sheets"
        ]},
        { title: "Before you leave", short: "Travel to exam", blockNums: [], tasks: [
          "Bring dictionary + calculator, travel early, stay calm"
        ]}
      ]
    }
  ]
};
