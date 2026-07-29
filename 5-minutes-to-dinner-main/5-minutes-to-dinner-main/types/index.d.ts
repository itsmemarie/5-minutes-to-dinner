import * as React from 'react';

/** A recipe summary as shown in a RecipeCard / RecipeBucket list. */
export interface RecipeSummary {
  id: string;
  name: string;
  /** Base (default) serving size the recipe was written for. */
  base: number;
  /** Minimum servings the recipe can be scaled down to. */
  min: number;
  /** Prep time in minutes. */
  prep: number;
  diet: 'omni' | 'veg' | 'vegan';
  /** Whether this main should be paired with a side dish. */
  hasSides?: boolean;
  /** Flagged as a "fun" recipe (shows an "F" badge). */
  fun?: boolean;
  /** Flagged as husband-approved (shows an "H" badge). */
  husband?: boolean;
}

export interface BtnProps {
  label: React.ReactNode;
  /** Stretch to fill the width of its container. */
  full?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** Use the muted secondary-container fill instead of the primary color. */
  secondary?: boolean;
  /** Compact sizing (smaller padding/font). */
  small?: boolean;
}
export declare function Btn(props: BtnProps): JSX.Element;

export interface PillBtnProps {
  label: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}
export declare function PillBtn(props: PillBtnProps): JSX.Element;

export interface StepperProps {
  value: number;
  /** Lower bound — the decrement button disables at this value. */
  min: number;
  onChange: (value: number) => void;
}
export declare function Stepper(props: StepperProps): JSX.Element;

export interface CapLabelProps {
  text: React.ReactNode;
}
/** Small uppercase caption label used for metadata tags. */
export declare function CapLabel(props: CapLabelProps): JSX.Element;

export interface SecHeadProps {
  text: React.ReactNode;
}
/** Uppercase section heading used above grouped content. */
export declare function SecHead(props: SecHeadProps): JSX.Element;

/** Thin horizontal divider using the design system's outline color. */
export declare function HDivider(): JSX.Element;

export interface SpinnerProps {
  /** Message shown below the spinner. Defaults to "Loading…". */
  msg?: string;
}
export declare function Spinner(props: SpinnerProps): JSX.Element;

/** Small pill badge marking a meal as today's plan. */
export declare function TodayTag(): JSX.Element;

export interface RecipeCardProps {
  r: RecipeSummary;
  /** Renders the card as already-selected and non-interactive. */
  disabled?: boolean;
  /** IDs of currently-selected recipes; `r.id` membership drives the checkmark. */
  selected: string[];
  onToggle: (id: string) => void;
  /** When provided, the recipe name becomes a clickable preview link. */
  onPreview?: (id: string) => void;
}
export declare function RecipeCard(props: RecipeCardProps): JSX.Element;

export interface RecipeBucketProps {
  /** Uppercase group title, e.g. "Default" or "Try Out". Bucket renders nothing when items is empty. */
  title: React.ReactNode;
  items: RecipeSummary[];
  disabled?: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onPreview?: (id: string) => void;
}
export declare function RecipeBucket(props: RecipeBucketProps): JSX.Element;
