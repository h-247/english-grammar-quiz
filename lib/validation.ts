import { z } from 'zod';

export const BlankImportSchema = z.object({
  id: z.string(),
  answers: z.array(z.string()).min(1, 'Each blank must have at least one accepted answer'),
  sourceQuestionId: z.string().optional(),
  objectiveId: z.string().optional(),
});

export const QuestionImportSchema = z.object({
  id: z.string(),
  topic: z.string(),
  section: z.string().optional(),
  type: z.string().default('multi_blank_fill_in_the_blank'),
  title: z.string(),
  prompt: z.string(),
  blanks: z.array(BlankImportSchema).min(1, 'Each question must have at least one blank'),
  objectiveIds: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  difficulty: z.string().optional(),
  sourcePdfPage: z.number().int().optional(),
});

export const UnitImportSchema = z.object({
  number: z.number().int().optional(),
  title: z.string().optional(),
  sourceFilename: z.string().optional(),
  sourcePdfPage: z.number().int().optional(),
  printedPage: z.number().int().optional(),
  scope: z.string().optional(),
});

export const TopicImportSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export const LearningObjectiveImportSchema = z.object({
  id: z.string(),
  description: z.string(),
});

export const QuizImportSchema = z.object({
  schemaVersion: z.string().default('2.0.0'),
  quizType: z.string().default('multi_blank_fill_in_the_blank'),
  language: z.string().default('en'),
  unit: UnitImportSchema.optional(),
  instructions: z.string().optional(),
  placeholderSyntax: z.string().default('{{n}}'),
  grading: z
    .object({
      mode: z.string().optional(),
      questionCompleteWhen: z.string().optional(),
      answerMatching: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
  topics: z.array(TopicImportSchema).optional(),
  learningObjectives: z.array(LearningObjectiveImportSchema).optional(),
  coverageAudit: z.record(z.string(), z.any()).optional(),
  questions: z.array(QuestionImportSchema).min(1, 'Quiz must have at least one question'),
});

export type QuizImportData = z.infer<typeof QuizImportSchema>;

export const StartAttemptSchema = z.object({
  duration_minutes: z.number().int().positive().optional().default(15),
  mode: z.enum(['timed', 'practice']).optional().default('timed'),
});

export const SaveAnswersSchema = z.object({
  answers: z.record(z.string(), z.record(z.string(), z.string())),
});

export const CheckQuestionSchema = z.object({
  question_id: z.string().min(1, 'question_id is required'),
  answers: z.record(z.string(), z.string()),
});

export const SubmitAttemptSchema = z.object({
  answers: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});

export const CourseCreateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  drive_folder_id: z.string().optional(),
  drive_folder_url: z.string().optional(),
  banner_url: z.string().optional(),
});
