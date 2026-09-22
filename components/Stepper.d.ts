import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export interface StepperProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  children: ReactNode;
  initialStep?: number;
  currentStep?: number;
  readOnly?: boolean;
  motionEnabled?: boolean;
  showNavigation?: boolean;
  showContent?: boolean;
  stepListLabel?: string;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: {
    step: number;
    currentStep: number;
    onStepClick: (step: number) => void;
  }) => ReactNode;
}

export default function Stepper(props: StepperProps): ReactNode;
export function Step(props: { children?: ReactNode }): ReactNode;
