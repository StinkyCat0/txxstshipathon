/** Prompt keys shown during onboarding/profile editing. Order = display order. */
export const PROMPT_CHOICES: { key: string; label: string }[] = [
  { key: 'green_flag', label: 'My green flag is' },
  { key: 'shower_thought', label: 'A shower thought I had' },
  { key: 'two_truths', label: 'Two truths and a lie' },
  { key: 'unpopular_opinion', label: 'My unpopular opinion' },
  { key: 'sunday_plans', label: 'Typical Sunday' },
  { key: 'red_flag_i_ignore', label: 'A red flag I ignore' },
  { key: 'most_spontaneous', label: 'Most spontaneous thing I did' },
  { key: 'dating_me_is', label: 'Dating me is like' },
];

export function promptLabel(key: string): string {
  return PROMPT_CHOICES.find((p) => p.key === key)?.label ?? key;
}
