import { describe, expect, it } from 'vitest'
import {
  assembleSet,
  extractCorrectAnswer,
  formatEmbeddedLabs,
  isLikelyCoverOrIndex,
  parseAnswerPage,
  parseQuestionPage,
  qcStemAgainstSource,
  splitChoices,
  stripChrome,
  stripFooterJunk
} from './examParser'
import { pairingKey, looksLikeAnswerPdf } from '../shared/files'
import { computeReviewStatus, totalTestSeconds, matrixStatus } from '../shared/types'
import { buildExcelRows } from '../shared/excelRows'
import { reviewSubset } from '../shared/review'

const SAMPLE_QUESTION = `
Exam Section : Item 1 of 50
National Board of Medical Examiners
Time Remaining:
Mark
Medicine Self-Assessment
4 hr 59 min 56 sec
1. A 45-year-old man comes to the office because of fatigue for 2 months. Which of the following is the most appropriate next step?
O A) Observation
O B) Bone marrow biopsy
O C) Iron studies
O D) Chest radiography
O E) Reassurance
Next
Lab Values Calculator Review
Help
Pause
`

const SAMPLE_ANSWER = `
Exam Section : Item 1 of 50
National Board of Medical Examiners
Mark
Medicine Self-Assessment
1. A 45-year-old man comes to the office because of fatigue for 2 months. Which of the following is the most appropriate next step?
A) Observation
B) Bone marrow biopsy
C) Iron studies
D) Chest radiography
E) Reassurance
Correct Answer: C.
Iron studies are the most appropriate next step.
Incorrect Answers: A, B, D, and E.
Educational Objective: Evaluate fatigue with targeted laboratory testing.
Next
Score Report
Lab Values Calculator
`

describe('examParser', () => {
  it('strips exam chrome and keeps the vignette', () => {
    const cleaned = stripChrome(SAMPLE_QUESTION)
    expect(cleaned).toContain('A 45-year-old man')
    expect(cleaned.toLowerCase()).not.toContain('lab values')
    expect(cleaned.toLowerCase()).not.toContain('national board')
  })

  it('parses a question stem and A-E choices', () => {
    const parsed = parseQuestionPage(SAMPLE_QUESTION, 1)
    expect(parsed?.sourceItemNumber).toBe(1)
    expect(parsed?.questionStem).toMatch(/^A 45-year-old man/)
    expect(parsed?.questionStem).not.toMatch(/Mark/)
    expect(parsed?.questionStem).not.toMatch(/hr 59 min/)
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.answerChoices[2].text).toMatch(/Iron studies/)
  })

  it('does not keep leftover choices that appear before the first item of a PDF', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 1 of 50
O D) Leftover from the previous form
O E) Another leftover choice
1. A 45-year-old man comes to the office because of fatigue for 2 months. Which of the following is the most appropriate next step?
O A) Observation
O B) Bone marrow biopsy
O C) Iron studies
O D) Chest radiography
O E) Reassurance
Next`,
      1
    )
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.answerChoices.map((c) => c.text)).toEqual([
      'Observation',
      'Bone marrow biopsy',
      'Iron studies',
      'Chest radiography',
      'Reassurance'
    ])
  })

  it('splits answer choices that were OCR’d onto the same line', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 1 of 50
1. A 45-year-old man comes to the office because of fatigue for 2 months. Which of the following is the most appropriate next step?
O A) Observation O B) Bone marrow biopsy
O C) Iron studies O D) Chest radiography
O E) Reassurance`,
      1
    )
    expect(parsed?.answerChoices.map((c) => `${c.label}) ${c.text}`)).toEqual([
      'A) Observation',
      'B) Bone marrow biopsy',
      'C) Iron studies',
      'D) Chest radiography',
      'E) Reassurance'
    ])
  })

  it('keeps Fahrenheit temperatures in the stem instead of making a fake choice F', () => {
    const text = `Exam Section : Item 19 of 50
19. A previously healthy 22-year-old woman comes to the physician because of a 2-day history of fever, chills, and left flank pain. She also has had nausea and vomited four times during this period. Her temperature is 38.9°C (102°F), pulse is 110/min, and blood pressure is 90/60 mm Hg. The abdomen is soft with tenderness to percussion over the left flank. The remainder of the examination shows no abnormalities. Laboratory studies show:
Hematocrit 39%
Leukocyte count 22,000/mm³
Which of the following is the most appropriate pharmacotherapy?
O A) Oral amoxicillin
O B) Oral azithromycin
O C) Intravenous amoxicillin
O D) Intravenous ceftriaxone
O E) Intravenous metronidazole`
    const parsed = parseQuestionPage(text, 19)
    expect(parsed?.questionStem).toMatch(/\(102°F\)/)
    expect(parsed?.questionStem).toMatch(/pulse is 110\/min/)
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.answerChoices.map((c) => c.text).join(' ')).not.toMatch(/pulse is 110/)
  })

  it('stitches a line-wrapped Fahrenheit value so F) is not a choice', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 33 of 50
33. Her temperature is 38.9°C (102°
F), pulse is 110/min, and blood pressure is 90/60 mm Hg. Which of the following is the most appropriate pharmacotherapy?
O A) Oral amoxicillin
O B) Oral azithromycin
O C) Intravenous amoxicillin
O D) Intravenous ceftriaxone
O E) Intravenous metronidazole`,
      33
    )
    expect(parsed?.questionStem).toMatch(/102°\s*F/)
    expect(parsed?.questionStem).toMatch(/pulse is 110\/min/)
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.answerChoices.find((c) => c.label === 'F')).toBeUndefined()
  })

  it('splits dense two-column choices like a later scanned form', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 1 of 50
1. Which of the following is the most appropriate pharmacotherapy?
A) Oral amoxicillin          B) Oral azithromycin
C) Intravenous amoxicillin   D) Intravenous ceftriaxone
E) Intravenous metronidazole`,
      1
    )
    expect(parsed?.answerChoices.map((c) => `${c.label}) ${c.text}`)).toEqual([
      'A) Oral amoxicillin',
      'B) Oral azithromycin',
      'C) Intravenous amoxicillin',
      'D) Intravenous ceftriaxone',
      'E) Intravenous metronidazole'
    ])
  })

  it('splits glued same-line choices with no space after the letter', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 2 of 50
2. Which of the following is the most likely diagnosis?
A)Cellulitis B)Erysipelas C)Folliculitis D)Impetigo E)Necrotizing fasciitis`,
      2
    )
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.answerChoices.map((c) => c.text)).toEqual([
      'Cellulitis',
      'Erysipelas',
      'Folliculitis',
      'Impetigo',
      'Necrotizing fasciitis'
    ])
  })

  it('repairs two-column OCR that glues the right option on with a 0 bubble', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 51 of 100
51. A 42-year-old man has greasy scaling of the scalp. Which of the following is the most likely diagnosis?
A) Exfoliate dermatitis 0
B) Lichen simplex chronicus Pediculosis capitis
C) D) Psoriasis
E) Seborrheic dermatitis 0`,
      51
    )
    expect(parsed?.answerChoices.map((c) => `${c.label}) ${c.text}`)).toEqual([
      'A) Exfoliate dermatitis',
      'B) Lichen simplex chronicus',
      'C) Pediculosis capitis',
      'D) Psoriasis',
      'E) Seborrheic dermatitis'
    ])
  })

  it('repairs two-column OCR when a later option starts with D)', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 52 of 100
52. A 24-year-old man has a recurrent groin rash. Which of the following is the most likely cause of this patient's recurrent infection?
A) Autoinfection 0
B) Clotrimazole resistance Impaired cellular immunity
C) D) Impaired humoral immunity
E) Reinfection from a sexual partner 0,`,
      52
    )
    expect(parsed?.answerChoices.map((c) => `${c.label}) ${c.text}`)).toEqual([
      'A) Autoinfection',
      'B) Clotrimazole resistance',
      'C) Impaired cellular immunity',
      'D) Impaired humoral immunity',
      'E) Reinfection from a sexual partner'
    ])
  })

  it('splits 0-glued pairs and swallowed H) on a longer scanned list', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 54 of 100
54. A 72-year-old woman has high blood pressure. Which of the following is the most likely diagnosis?
A) Acute glomerulonephritis 0 Acute porphyria
B) Coarctation of the aorta
C) D) Cushing syndrome
E) Hyperaldosteronism 0 Hyperparathyroidism
F) Hyperthyroidism
G) H) Pheochromocytoma
I) Renal artery stenosis 0,`,
      54
    )
    expect(parsed?.answerChoices.map((c) => `${c.label}) ${c.text}`)).toEqual([
      'A) Acute glomerulonephritis',
      'B) Acute porphyria',
      'C) Coarctation of the aorta',
      'D) Cushing syndrome',
      'E) Hyperaldosteronism',
      'F) Hyperparathyroidism',
      'G) Hyperthyroidism',
      'H) Pheochromocytoma',
      'I) Renal artery stenosis'
    ])
  })

  it('rejoins an OCR fragment that was split after a 0 bubble', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 58 of 100
58. A 55-year-old man is in a coma. Which of the following is the most appropriate initial step in management?
A) Administration of digitalis 0 of verapamil
B) Administration
C) Carotid sinus massage
D) Direct current countershock
E) External pacing 0,`,
      58
    )
    expect(parsed?.answerChoices.map((c) => `${c.label}) ${c.text}`)).toEqual([
      'A) Administration of digitalis',
      'B) Administration of verapamil',
      'C) Carotid sinus massage',
      'D) Direct current countershock',
      'E) External pacing'
    ])
  })

  it('collapses Form 6 glyph spaces inside stems and choices', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 18 of 50
18. A 37-year-old woman with type 1 diabetes me llitus is brought to the emergency department because of anx i ety and nu mb ness of the r ecent ly. D ur ing the past 6 months she has had nume r ous. Cran ial nerves are intact. Musc le strength is 5/5. Which of the following is the most likely diagnosis?
A) Brachia! pl exopa t hy
B) Ce rvica l stenosis
C) Co nversion di sor der
D) Diabetic polyneuro pat hy
E) Sy ri ngomyelia`,
      18
    )
    expect(parsed?.questionStem).toMatch(/diabetes mellitus/)
    expect(parsed?.questionStem).toMatch(/anxiety/)
    expect(parsed?.questionStem).toMatch(/numbness/)
    expect(parsed?.questionStem).toMatch(/recently/)
    expect(parsed?.questionStem).toMatch(/During/)
    expect(parsed?.questionStem).toMatch(/numerous/)
    expect(parsed?.questionStem).toMatch(/Cranial/)
    expect(parsed?.questionStem).toMatch(/Muscle/)
    expect(parsed?.questionStem).not.toMatch(/me llitus/)
    expect(parsed?.answerChoices.map((c) => c.text)).toEqual([
      'Brachial plexopathy',
      'Cervical stenosis',
      'Conversion disorder',
      'Diabetic polyneuropathy',
      'Syringomyelia'
    ])
  })

  it('keeps Oral as a complete word instead of stripping the leading O', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 18 of 50
18. A 62-year-old man has right leg pain. Which of the following is the most appropriate next step?
A) Oral administration of aspirin
B) Oral administration of warfarin
C) Subcutaneous administration of enoxaparin
D) CT angiography of the chest
E) Placement of an inferior vena cava filter`,
      18
    )
    expect(parsed?.answerChoices[0]?.text).toMatch(/^Oral administration of aspirin/)
    expect(parsed?.answerChoices[1]?.text).toMatch(/^Oral administration of warfarin/)
  })

  it('parses a correct answer letter and explanation', () => {
    const parsed = parseAnswerPage(SAMPLE_ANSWER, 2)
    expect(parsed?.correctAnswer).toBe('C')
    expect(parsed?.explanation).toMatch(/Correct Answer: C/)
    expect(parsed?.explanation).toMatch(/Educational Objective/)
  })

  it('skips cover/index pages', () => {
    expect(isLikelyCoverOrIndex('INTERNAL MEDICINE CMS 10 ANSWERS')).toBe(true)
    expect(isLikelyCoverOrIndex('System: Cardiovascular : 2,3,6')).toBe(true)
    expect(isLikelyCoverOrIndex(SAMPLE_QUESTION)).toBe(false)
  })

  it('merges question and answer PDFs by item number', () => {
    const result = assembleSet(
      [{ pageNumber: 1, text: SAMPLE_QUESTION, usedOcr: false }],
      [{ pageNumber: 1, text: SAMPLE_ANSWER, usedOcr: false }]
    )
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].correctAnswer).toBe('C')
    expect(result.questions[0].answerChoices).toHaveLength(5)
    expect(result.questions[0].usedOriginalImage).toBeFalsy()
  })

  it('accepts a parsed stem that matches the source PDF page', () => {
    const parsed = parseQuestionPage(SAMPLE_QUESTION, 1)
    const qc = qcStemAgainstSource(parsed?.questionStem ?? '', SAMPLE_QUESTION, {
      itemNumber: 1,
      filledChoices: 5
    })
    expect(qc.ok).toBe(true)
  })

  it('flags a generated stem that does not match the original PDF', () => {
    const qc = qcStemAgainstSource('Unrelated generated text.', SAMPLE_QUESTION, {
      itemNumber: 1,
      filledChoices: 5
    })
    expect(qc.ok).toBe(false)
    expect(qc.reasons.length).toBeGreaterThan(0)
  })

  it('marks a too-short stem to show the original PDF page', () => {
    const short = SAMPLE_QUESTION.replace(
      /1\. A 45-year-old[\s\S]*?next step\?/,
      '1. Hi?'
    )
    const result = assembleSet([{ pageNumber: 1, text: short, usedOcr: false }], [])
    expect(result.questions[0]?.questionStem).toMatch(/Hi\?/)
    expect(result.questions[0].usedOriginalImage).toBe(true)
    expect(result.warnings.some((warning) => /original PDF page/i.test(warning))).toBe(true)
  })

  it('warns when question and answer counts differ', () => {
    const q2 = SAMPLE_QUESTION.replace('Item 1 of 50', 'Item 2 of 50').replace('1. A 45', '2. A 45')
    const result = assembleSet(
      [
        { pageNumber: 1, text: SAMPLE_QUESTION, usedOcr: false },
        { pageNumber: 2, text: q2, usedOcr: false }
      ],
      [{ pageNumber: 1, text: SAMPLE_ANSWER, usedOcr: false }]
    )
    expect(result.questions).toHaveLength(2)
    expect(result.warnings.some((w) => /do not match/i.test(w))).toBe(true)
  })

  it('extracts (B is correct) style keys', () => {
    expect(extractCorrectAnswer('Immediate treatment is warranted (B is correct).')).toBe('B')
    expect(extractCorrectAnswer('(B is correct, E is incorrect). Treatment with N-acetylcysteine')).toBe('B')
    expect(extractCorrectAnswer('neutrophil elastase (Fis correct). Chronic exposure')).toBe('F')
    expect(extractCorrectAnswer('(C) For melanoma, any biopsy technique other than a full-thickness biopsy is inappropriate.')).toBe('C')
  })

  it('keeps extra choice letters when present', () => {
    const body = 'Stem here?\nA) One\nB) Two\nC) Three\nD) Four\nE) Five\nF) Six'
    expect(splitChoices(body).choices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('strips the footer tail from the last choice', () => {
    expect(stripFooterJunk('Surgical excision r ~ ~ p, r,')).toBe('Surgical excision')
    expect(stripFooterJunk('Sexual activity without contraception ~ ~ p, r,')).toBe(
      'Sexual activity without contraception'
    )
    expect(stripFooterJunk('Sickle cell disease r')).toBe('Sickle cell disease')
  })

  it('puts lab values on separate lines', () => {
    const formatted = formatEmbeddedLabs(`A 32-year-old woman has polyuria.
Serum studies show:
Na+
Cl-
K+
HCO3-
Glucose
Which of the following is the most likely cause of her acidosis?
139 mEq/L
99 mEq/L
4.7 mEq/L
18 mEq/L
783 mg/dL`)
    expect(formatted).toMatch(/Na\+\s+139 mEq\/L/)
    expect(formatted).toMatch(/Glucose\s+783 mg\/dL/)
    expect(formatted).toMatch(/Which of the following/)
  })

  it('pairs multi-section laboratory panels without a screenshot', () => {
    const formatted = formatEmbeddedLabs(`A 72-year-old woman has shortness of breath.
Laboratory studies show:
Hemoglobin
Leukocyte count
Serum
Na+
K+
Urine protein
5 g/dL
9000/mm3
140 mEq/L
4 mEq/L
1+
An x-ray of the chest shows congestion.
Which of the following is the most likely cause of these findings?`)
    expect(formatted).toMatch(/Hemoglobin\s+5 g\/dL/)
    expect(formatted).toMatch(/Leukocyte count\s+9000\/mm³/)
    expect(formatted).toMatch(/^Serum$/m)
    expect(formatted).toMatch(/Na\+\s+140 mEq\/L/)
    expect(formatted).toMatch(/Urine protein\s+1\+/)
    expect(formatted).toMatch(/Which of the following/)
    expect(formatted).toMatch(/An x-ray of the chest shows congestion/)
  })

  it('pairs interleaved arterial-blood-gas lines', () => {
    const formatted = formatEmbeddedLabs(`After hip replacement she has chest pain.
Arterial blood gas analysis on room air shows:
pH
7.46
Pco 2
28 mm Hg
Po 2
62 mm Hg
Which of the following postoperative treatments is most likely to have prevented this condition?`)
    expect(formatted).toMatch(/pH\s+7\.46/)
    expect(formatted).toMatch(/Pco2\s+28 mm Hg/)
    expect(formatted).toMatch(/Po2\s+62 mm Hg/)
  })

  it('does not steal 0.9% saline from an answer choice', () => {
    const formatted = formatEmbeddedLabs(
      `Laboratory studies show:
Ferritin
Uric acid
14 ng/mL
12.9 mg/dL
Which of the following interventions is best?
0 A) Aspirin therapy
0 B) Infusion of 0.9% Saline
0 C) Phlebotomy`
    )
    expect(formatted).toMatch(/Ferritin\s+14 ng\/mL/)
    expect(formatted).toMatch(/Uric acid\s+12\.9 mg\/dL/)
    expect(formatted).not.toMatch(/0\.9%/)
    expect(formatted).not.toMatch(/saline/i)
  })

  it('formats a two-column on-admission vs now panel', () => {
    const formatted = formatEmbeddedLabs(`Laboratory studies show:
Fingerstick blood glucose
Serum
Urea nitrogen (mg/dl )
Creatinine (mg/dl )
Urine
Specific gravity
Casts
On Admission
4+
38
1.8
1.028
None
Now
4+
54
2.6
1.011
coarse granular
Which of the following is the most likely explanation?`)
    expect(formatted).toMatch(/On Admission\s+Now/)
    expect(formatted).toMatch(/Urea nitrogen\s+38\s+54/)
    expect(formatted).toMatch(/Casts\s+None\s+coarse granular/)
  })

  it('labels unnamed arterial-blood-gas values', () => {
    const formatted = formatEmbeddedLabs(`Arterial blood gas analysis on an FiO2 of 100% and a positive end-expiratory pressure of 20 cm Hp shows:
7.42
38 mm Hg
60 mm Hg
Which of the following is the most likely cause?`)
    expect(formatted).toMatch(/pH\s+7\.42/)
    expect(formatted).toMatch(/Pco2\s+38 mm Hg/)
    expect(formatted).toMatch(/Po2\s+60 mm Hg/)
  })

  it('splits mashed lab names and OCR chloride', () => {
    const formatted = formatEmbeddedLabs(`Laboratory studies show:
Mean corpuscular volume102 µm3
Partial thromboplastin time28 sec
c 1-
106 mEq/L
Which of the following is the most likely diagnosis?`)
    expect(formatted).toMatch(/Mean corpuscular volume\s+102 µm³/)
    expect(formatted).toMatch(/Partial thromboplastin time\s+28 sec/)
    expect(formatted).toMatch(/Cl-\s+106 mEq\/L/)
  })

  it('pairs urine dipstick names that sit after the last choice', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 44 of 50
44. A 78-year-old man has urinary frequency.
Laboratory studies show:
Serum creatinine
Urine
Which of the following is the most likely diagnosis?
0 A) Benign prostatic hyperplasia
0 B) Cauda equina syndrome
0 C) Dementia, Alzheimer type
0 D) Normal-pressure hydrocephalus
0 E) Urinary tract infection Protein WBC RBC
1.6 mg/dl
1+
1-2/hpf
2-4/hpf`,
      44
    )
    expect(parsed?.questionStem).toMatch(/Serum creatinine\s+1\.6 mg\/dl/)
    expect(parsed?.questionStem).toMatch(/Protein\s+1\+/)
    expect(parsed?.questionStem).toMatch(/WBC\s+1-2\/hpf/)
    expect(parsed?.questionStem).toMatch(/RBC\s+2-4\/hpf/)
    expect(parsed?.answerChoices.at(-1)?.text).toBe('Urinary tract infection')
  })

  it('splits two-column K-M choices off the earlier option', () => {
    const text = `Exam Section : Item 20 of 50
20. A 60-year-old woman has swelling of the left leg.
Which of the following is the most likely diagnosis?
0 A) Cellulitis
0 B) Cirrhosis
0 C) Congestive heart failure
0 D) Deep venous thrombosis
0 E) Lymphangitis 0 K) Stasis dermatitis
0 F) Lymphedema 0 L) Varicose veins
0 G) Malnutrition
0 H) Nephrotic syndrome
0 I) Postphlebitic syndrome
0 J) Pulmonary hypertension`
    const parsed = parseQuestionPage(text, 20)
    expect(parsed?.answerChoices.map((c) => c.label).join('')).toBe('ABCDEFGHIJKL')
    expect(parsed?.answerChoices.find((c) => c.label === 'E')?.text).toBe('Lymphangitis')
    expect(parsed?.answerChoices.find((c) => c.label === 'K')?.text).toBe('Stasis dermatitis')
    expect(parsed?.answerChoices.find((c) => c.label === 'L')?.text).toBe('Varicose veins')
  })

  it('reads OCR bullet choices that use A) or A.', () => {
    const paren = parseQuestionPage(
      `Exam Section : Item 1 of 50
1. A 42-year-old man needs a vaccine. Which of the following vaccinations is most appropriate at this time?
• A) Human papillomavirus
• B) Inactivated influenza virus
• C) Measles-mumps-rubella virus
• D) Meningococcal
• E) Rabies`,
      1
    )
    expect(paren?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(paren?.answerChoices[1].text).toMatch(/Inactivated influenza/)
    const dotted = parseQuestionPage(
      `Question 1 of 50
An 18-year-old man has heat stroke. Which of the following is the most appropriate next step in management?
• A. Alcohol sponge bath
• B. Aspirin therapy
• C. Dantrolene therapy
• D. Evaporative cooling
• E. Gastric lavage with cold water`,
      1
    )
    expect(dotted?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(dotted?.answerChoices[3].text).toMatch(/Evaporative cooling/)
  })

  it('keeps numeric percent choices instead of dropping them as sparse', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 42 of 50
42. Which of the following represents the sensitivity of the new stool test for H. pylori infection in this study?
0 A) 10%
0 B) 20%
0 C) 40%
0 D) 60%
0 E) 80%`,
      42
    )
    expect(parsed?.answerChoices.map((c) => `${c.label})${c.text}`)).toEqual([
      'A)10%',
      'B)20%',
      'C)40%',
      'D)60%',
      'E)80%'
    ])
    expect(parsed?.needsTableImage).toBeFalsy()
  })

  it('maps OCR 1) after H) to I) and lowercase c) to C)', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 2 of 50
2. Which of the following age-related changes is the most likely explanation?
• A) Decreased airway elasticity
• B) Decreased baroreflex
• C) Decreased mucociliary clearance
• D) Decreased thyroid function
• E) Diastolic cardiac dysfunction
• F) Impaired cardiac response to exercise
• G) Impaired T-lymphocyte function
• H) Impaired thirst
• 1 ) Increased lung compliance
• J ) Renal salt wasting`,
      2
    )
    expect(parsed?.answerChoices.map((c) => c.label).join('')).toBe('ABCDEFGHIJ')
    expect(parsed?.answerChoices.find((c) => c.label === 'I')?.text).toMatch(/Increased lung compliance/)
    const lower = parseQuestionPage(
      `Exam Section : Item 31 of 50
31. which of the following complications?
• A) Deep venous thrombosis
• B) Hypothyroidism
• c) Nephrolithiasis
• D) Peripheral vascular disease
• E) Stasis dermatitis`,
      31
    )
    expect(lower?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(lower?.answerChoices[2].text).toMatch(/Nephrolithiasis/)
  })

  it('stops choices at Proceed to Next Item', () => {
    const parsed = parseQuestionPage(
      `Item 42 of 50
Which of the following is the most appropriate initial step in pharmacotherapy?
• A. Amoxicillin
O B. Ciprofloxacin
O C. Famciclovir
• D. Ibuprofen
• E. Prednisone
Proceed to Next Item
Full Screen Settings A 27-year-old woman comes to the physician because of a 1-month history of persistent pain.`,
      42
    )
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.answerChoices[4].text).toBe('Prednisone')
  })

  it('flags table-grid questions even when OCR leaves choice cells empty', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 22 of 50
22. Which of the following sets of laboratory values is most likely in this patient?
• A.
O B.
• C.
D.
• E.
• F.
Serum Osmolality
290
Urine Osmolality
200`,
      22
    )
    expect(parsed?.needsTableImage).toBe(true)
    expect(parsed?.answerChoices.map((c) => c.label).join('')).toMatch(/ABCDE/)
  })

  it('strips trailing exam-footer junk from the last choice', () => {
    const text = `Exam Section : Item 1 of 50
1. A 40-year-old man has a rash on his scalp. Which of the following is the most likely diagnosis?
O A) Exfoliative dermatitis
O B) Lichen simplex chronicus
O C) Pediculosis capitis
O D) Psoriasis
O E) Seborrheic dermatitis "' ~ p,,.,`
    const parsed = parseQuestionPage(text, 1)
    expect(parsed?.answerChoices.at(-1)?.text).toBe('Seborrheic dermatitis')
  })

  it('parses Q-marked answer bubbles', () => {
    const text = `Exam Section : Item 10 of 50
10. A 55-year-old woman has hypertension.
Urinalysis shows:
Glucose
Protein
RSC
WBC
negative
1+
none
none
Which of the following is the most appropriate next step in management?
Q A) Schedule a follow-up visit in 3 months
Q B) Decrease her sodium intake to 1 g daily
Q C) Begin hydrochlorothiazide therapy
Q D) Begin lisinopril therapy
Q E) Begin metoprolol therapy`
    const parsed = parseQuestionPage(text, 10)
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.questionStem).toMatch(/Glucose\s+negative/)
    expect(parsed?.questionStem).toMatch(/RBC\s+none/)
  })

  it('keeps matching-set vignettes after the shared choices', () => {
    const text = `Exam Section : Item 28 of 50
The response options for the next 2 items are the same. Select one answer for each item in the set.
For each patient with liver enzyme abnormalities, select the most likely diagnosis.
0 A) Acute cholecystitis
0 B) Acute pancreatitis
0 F) Chronic hepatitis C
0 E) Chronic hepatitis B
0 J) Sclerosing cholangitis
28. A 36-year-old man comes to the physician because of fever and abdominal pain.
Laboratory studies show:
Prothrombin time
18 sec
r ~ ~ p, r,`
    const parsed = parseQuestionPage(text, 28)
    expect(parsed?.sourceItemNumber).toBe(28)
    expect(parsed?.questionStem).toMatch(/36-year-old man/)
    expect(parsed?.questionStem).toMatch(/response options for the next 2 items/)
    expect(parsed?.answerChoices[0].label).toBe('A')
    expect(parsed?.answerChoices.map((c) => c.label).join('')).toBe('ABEFJ')
    expect(parsed?.answerChoices.at(-1)?.text).not.toMatch(/36-year-old/)
    expect(parsed?.answerChoices.at(-1)?.text).not.toMatch(/~/ )
  })

  it('keeps vitamin choices instead of treating them as a table', () => {
    const text = `Exam Section : Item 36 of 50
36. A 48-year-old man with alcoholism is brought to the emergency department confused and drowsy.
Administration of which of the following is the most appropriate intervention?
0 A) Folic acid
0 B) Glucose
0 C) Vitamin B1 (thiamine)
0 D) Vitamin B6
0 E) Vitamin B12 (cyanocobalamin)`
    const parsed = parseQuestionPage(text, 36)
    expect(parsed?.needsTableImage).toBeFalsy()
    expect(parsed?.answerChoices.map((c) => c.text)).toEqual([
      'Folic acid',
      'Glucose',
      'Vitamin B1 (thiamine)',
      'Vitamin B6',
      'Vitamin B12 (cyanocobalamin)'
    ])
  })

  it('unwraps PDF line wraps and flags a blood-smear figure', () => {
    const text = `Exam Section : Item 39 of 50
39. A 65-year-old woman has fatigue, pallor, and glossitis. Hemoglobin concentration is
8 g/dl, and mean corpuscular volume is 115 µm 3• Leukocyte and platelet counts are
normal. A blood smear is shown. Which of the following is the most likely primary
pathophysiologic mechanism causing her anemia?
0 A) Defective porphyrin metabolism
0 B) Faulty protein transcription
0 C) Impaired DNA synthesis
0 D) Inadequate erythropoietin
0 E) Unbalanced synthesis of globulin chains`
    const parsed = parseQuestionPage(text, 39)
    expect(parsed?.questionStem).toMatch(/Hemoglobin concentration is 8 g\/dl/)
    expect(parsed?.questionStem).not.toMatch(/is\n8 /)
    expect(parsed?.needsFigure).toBe(true)
  })

  it('keeps compound hyphens when joining wrapped PDF lines', () => {
    const parsed = parseQuestionPage(
      `Exam Section : Item 12 of 50
12. A 27-year-old woman who is HIV positive comes to the physician because of a 1-day history of fever, shortness of breath, right-
sided chest pain, and cough. Which of the following is the most appropriate pharmacotherapy?
0 A) Ceftriaxone
0 B) Gentamicin
0 C) Isoniazid
0 D) Penicillin
0 E) Prednisone`,
      12
    )
    expect(parsed?.questionStem).toMatch(/right-sided chest pain/)
    expect(parsed?.questionStem).not.toMatch(/rightsided/)
  })

  it('does not pair MCV with ferritin units', () => {
    const formatted = formatEmbeddedLabs(`Laboratory studies show:
Hematocrit
Mean corpuscular volume
Erythrocyte sedimentation rate
Ferritin
Iron
32%
75 µm3
50 mm/h
300 ng/mL
40 µg/dL
Which of the following is the most appropriate next step in management of this patient's anemia?`)
    expect(formatted).toMatch(/Hematocrit\s+32%/)
    expect(formatted).toMatch(/Mean corpuscular volume\s+75 µm³/)
    expect(formatted).toMatch(/Erythrocyte sedimentation rate\s+50 mm\/h/)
    expect(formatted).toMatch(/Ferritin\s+300 ng\/mL/)
    expect(formatted).not.toMatch(/Mean corpuscular volume\s+300/)
  })

  it('prefers filled-in answer choices when the question side is empty', () => {
    const result = assembleSet(
      [
        {
          pageNumber: 1,
          text: `Exam Section : Item 1 of 50
1. Stem here which of the following is the most likely set of findings on urinalysis?
0 A) 1.003 1+ 30
0 B) 1.005 trace 30
0 C) 1.012 2 5
0 D) 1.012 1+ 3
0 E) 1.012 3+ 100
0 F) 1.030 4+ 30`,
          usedOcr: false
        }
      ],
      [
        {
          pageNumber: 1,
          text: SAMPLE_ANSWER,
          usedOcr: false
        }
      ]
    )
    expect(result.questions[0].needsTableImage).toBe(true)
  })

  it('coalesces a stem page with the following same-item choice page', () => {
    const result = assembleSet(
      [
        {
          pageNumber: 6,
          text: `Item 4 of 50
A 67-year-old woman is admitted to the hospital. A chest x-ray shows a 5-cm right hilar density. Which of the following is the most likely explanation for this patient's hypercalcemia?`,
          usedOcr: true
        },
        {
          pageNumber: 7,
          text: `Item 4 of 50
Which of the following is the most likely explanation for this patient's hypercalcemia?
• A. Granulomatous disease
• B. Increased vitamin D concentration
• C. Parathyroid hormone-related peptide
• D. Primary hyperparathyroidism
• E. Thiazide diuretics
Proceed to Next Item`,
          usedOcr: true
        }
      ],
      []
    )
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].questionStem).toMatch(/67-year-old/)
    expect(result.questions[0].answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(result.questions[0].answerChoices[2].text).toMatch(/Parathyroid/)
  })

  it('reads Question 21 or 50 OCR headers as item 21', () => {
    const parsed = parseQuestionPage(
      `* 8 all 62% = 9:43 pm
+ = question 21 or 50
A 32-year-old woman with asthma comes to the physician because of wheezing.
Which of the following is the most appropriate next step in diagnosis?
• A. Examination of the stool for ova and parasites
• B. Measurement of serum angiotensin-converting enzyme activity
• C. Measurement of serum a1-antitrypsin concentration
• D. Serum assay for IgE and IgG antibodies to Aspergillus species
• E. Methacholine challenge test
• F. Bone marrow biopsy`,
      22
    )
    expect(parsed?.sourceItemNumber).toBe(21)
    expect(parsed?.questionStem).toMatch(/^A 32-year-old woman/)
    expect(parsed?.answerChoices).toHaveLength(6)
  })

  it('ignores sidebar L. chrome so it does not become a sixth choice', () => {
    const parsed = parseQuestionPage(
      `Item 42 of 50
Calculator
C3
L.
Full Screen
Settings
A 27-year-old woman comes to the physician. Which of the following is the most appropriate initial step in pharmacotherapy?
• A. Amoxicillin
O B. Ciprofloxacin
O C. Famciclovir
• D. Ibuprofen
• E. Prednisone
Proceed to Next Item`,
      42
    )
    expect(parsed?.answerChoices.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed?.answerChoices.map((c) => c.text).join(' ')).not.toMatch(/Full Screen|27-year-old/)
  })

  it('keeps answer explanations out of the exam stem', () => {
    const result = assembleSet(
      [
        {
          pageNumber: 1,
          text: `Exam Section : Item 2 of 50
2. An unconscious 37-year-old woman is brought to the emergency department after being found in an abandoned house. Which of the following is the most likely diagnosis?
O A) Ethylene glycol
O B) Hepatic failure
O C) Methanol
O D) Rhabdomyolysis
O E) Salicylate`,
          usedOcr: false
        }
      ],
      [
        {
          pageNumber: 1,
          text: `Exam Section : Item 2 of 50
2. An unconscious 37-year-old woman is brought to the emergency department after being found in an abandoned house. Which of the following is the most likely diagnosis?
O A) Ethylene glycol
O B) Hepatic failure
O C) Methanol
O D) Rhabdomyolysis
O E) Salicylate
Correct Answer: E.
Rhabdomyolysis is the result of infectious, ischemic, or traumatic skeletal muscle cell lysis.
Incorrect Answers: A, B, C, and D.
Choice A: Ethylene glycol poisoning presents with anion-gap acidosis.
Educational Objective: Recognize rhabdomyolysis.`,
          usedOcr: false
        }
      ]
    )
    expect(result.questions[0].questionStem).toMatch(/unconscious 37-year-old/)
    expect(result.questions[0].questionStem).not.toMatch(/Correct Answer/)
    expect(result.questions[0].questionStem).not.toMatch(/Incorrect Answers/)
    expect(result.questions[0].questionStem).not.toMatch(/Educational Objective/)
    expect(result.questions[0].questionStem).not.toMatch(/Choice A:/)
    expect(result.questions[0].correctAnswer).toBe('E')
    expect(result.questions[0].explanation).toMatch(/Educational Objective/)
  })

  it('matches explanation pages that lack item headers using the vignette', () => {
    const result = assembleSet(
      [
        {
          pageNumber: 1,
          text: `Question 1 of 50
An 18-year-old man is brought to the emergency department 30 minutes after losing consciousness at football practice. Which of the following is the most appropriate next step?
• A. Alcohol sponge bath
• B. Aspirin therapy
• C. Dantrolene therapy
• D. Evaporative cooling
• E. Gastric lavage`,
          usedOcr: true
        },
        {
          pageNumber: 2,
          text: `Question 2 of 50
A 71-year-old man is admitted to the hospital for management of congestive heart failure. Which of the following is the most appropriate next step?
• A. Captopril
• B. Digoxin
• C. Furosemide
• D. Metoprolol
• E. Spironolactone`,
          usedOcr: true
        }
      ],
      [
        {
          pageNumber: 1,
          text: `A 71-year-old man is admitted to the hospital for management of congestive heart failure. Which of the following is the most appropriate next step?
A. Captopril
B. Digoxin
Correct Answer: C.
Educational Objective: Loop diuretics are first-line therapy for decompensated heart failure.`,
          usedOcr: true
        }
      ]
    )
    expect(result.questions[0].correctAnswer).toBeNull()
    expect(result.questions[1].correctAnswer).toBe('C')
    expect(result.questions[1].questionStem).toMatch(/71-year-old/)
    expect(result.questions[1].questionStem).not.toMatch(/Correct Answer|Educational Objective/)
  })
})

describe('pairing and scoring', () => {
  it('pairs 3 Q.pdf with 3A.pdf', () => {
    expect(pairingKey('3 Q.pdf')).toBe(pairingKey('3A.pdf'))
    expect(looksLikeAnswerPdf('3A.pdf')).toBe(true)
    expect(looksLikeAnswerPdf('3 Q.pdf')).toBe(false)
  })

  it('computes 1.5 minutes per question', () => {
    expect(totalTestSeconds(50)).toBe(75 * 60)
    expect(totalTestSeconds(100)).toBe(150 * 60)
  })

  it('prioritizes flagged status as yellow in the matrix', () => {
    expect(matrixStatus({ flagged: true, userAnswer: 'A' } as never)).toBe('flagged')
    expect(matrixStatus({ flagged: false, userAnswer: 'A' } as never)).toBe('answered')
    expect(matrixStatus({ flagged: false, userAnswer: null } as never)).toBe('unanswered')
  })

  it('scores review status from selected vs correct answers', () => {
    expect(computeReviewStatus({ userAnswer: 'C', correctAnswer: 'C' })).toBe('correct')
    expect(computeReviewStatus({ userAnswer: 'A', correctAnswer: 'C' })).toBe('incorrect')
    expect(computeReviewStatus({ userAnswer: null, correctAnswer: 'C' })).toBe('unanswered')
  })
})

describe('excel export rows', () => {
  it('includes only questions with non-empty notes', () => {
    const rows = buildExcelRows([
      {
        questionNumber: 1,
        notes: '  remember this  ',
        questionStem: 'Stem 1',
        answerChoices: [
          { label: 'A', text: 'One' },
          { label: 'B', text: 'Two' }
        ]
      },
      {
        questionNumber: 2,
        notes: '   ',
        questionStem: 'Stem 2',
        answerChoices: [{ label: 'A', text: 'X' }]
      }
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe(1)
    expect(rows[0][1]).toBe('remember this')
    expect(rows[0][3]).toContain('A. One')
    expect(rows[0][3]).toContain('B. Two')
  })
})

describe('review navigation subset', () => {
  const questions = [
    { questionNumber: 1, flagged: false, userAnswer: 'A' },
    { questionNumber: 2, flagged: true, userAnswer: 'B' },
    { questionNumber: 3, flagged: false, userAnswer: null }
  ] as never[]

  it('filters all, flagged, and unanswered review sets', () => {
    expect(reviewSubset(questions, 'all').map((q) => q.questionNumber)).toEqual([1, 2, 3])
    expect(reviewSubset(questions, 'flagged').map((q) => q.questionNumber)).toEqual([2])
    expect(reviewSubset(questions, 'unanswered').map((q) => q.questionNumber)).toEqual([3])
  })
})
