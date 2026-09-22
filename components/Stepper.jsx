'use client';

// React Bits JS-CSS Stepper: https://reactbits.dev/components/stepper
// Adapted for controlled transaction progress, accessibility and Zarman's light theme.
import React, { useState, Children, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

import './Stepper.css';

export default function Stepper({
  children,
  initialStep = 1,
  currentStep: controlledStep,
  readOnly = false,
  motionEnabled = true,
  showNavigation = true,
  showContent = true,
  stepListLabel = 'Steps',
  className = '',
  dir = 'ltr',
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  completeButtonText = 'Complete',
  disableStepIndicators = false,
  renderStepIndicator,
  ...rest
}) {
  const [internalStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const currentStep = Math.max(1, Math.min(totalSteps + 1, controlledStep ?? internalStep));
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = newStep => {
    if (readOnly || !Number.isInteger(newStep) || newStep < 1 || newStep > totalSteps + 1) return;
    if (controlledStep === undefined) setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div className={`react-bits-stepper outer-container ${className}`} dir={dir} {...rest}>
      <div
        className={`step-circle-container ${stepCircleContainerClassName}`}
      >
        <ol className={`step-indicator-row ${stepContainerClassName}`} aria-label={stepListLabel}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: clicked => {
                      if (readOnly || disableStepIndicators) return;
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    disableStepIndicators={disableStepIndicators || readOnly}
                    currentStep={currentStep}
                    onClickStep={clicked => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }}
                  />
                )}
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} motionEnabled={motionEnabled} />}
              </React.Fragment>
            );
          })}
        </ol>

        {showContent && <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={dir === 'rtl' ? -direction : direction}
          className={`step-content-default ${contentClassName}`}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>}

        {!isCompleted && showNavigation && !readOnly && (
          <div className={`footer-container ${footerClassName}`}>
            <div className={`footer-nav ${currentStep !== 1 ? 'spread' : 'end'}`}>
              {currentStep !== 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className={`back-button ${currentStep === 1 ? 'inactive' : ''}`}
                  {...backButtonProps}
                >
                  {backButtonText}
                </button>
              )}
              <button type="button" onClick={isLastStep ? handleComplete : handleNext} className="next-button" {...nextButtonProps}>
                {isLastStep ? completeButtonText : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepContentWrapper({ isCompleted, currentStep, direction, children, className }) {
  const [parentHeight, setParentHeight] = useState(0);
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={reducedMotion ? { duration: 0 } : { type: 'spring', duration: 0.4 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={setParentHeight}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SlideTransition({ children, direction, onHeightReady }) {
  const containerRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => onHeightReady(element.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={reducedMotion ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 1 } } : stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: reducedMotion ? 0 : 0.4 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

const stepVariants = {
  enter: dir => ({
    x: dir >= 0 ? '-100%' : '100%',
    opacity: 0
  }),
  center: {
    x: '0%',
    opacity: 1
  },
  exit: dir => ({
    x: dir >= 0 ? '50%' : '-50%',
    opacity: 0
  })
};

export function Step({ children }) {
  return <div className="step-default">{children}</div>;
}

function StepIndicator({ step, currentStep, onClickStep, disableStepIndicators }) {
  const reducedMotion = useReducedMotion();
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) onClickStep(step);
  };

  return (
    <li className="step-indicator" aria-current={status === 'active' ? 'step' : undefined}>
    <motion.button type="button" onClick={handleClick} disabled={disableStepIndicators} aria-label={`Step ${step}`} animate={status} initial={false}>
      <motion.div
        variants={{
          inactive: { scale: 1, backgroundColor: '#f1f3f9', color: '#64748b' },
          active: { scale: 1, backgroundColor: '#5227FF', color: '#5227FF' },
          complete: { scale: 1, backgroundColor: '#5227FF', color: '#3b82f6' }
        }}
        transition={{ duration: reducedMotion ? 0 : 0.3 }}
        className="step-indicator-inner"
      >
        {status === 'complete' ? (
          <CheckIcon className="check-icon" />
        ) : status === 'active' ? (
          <div className="active-dot" />
        ) : (
          <span className="step-number">{step}</span>
        )}
      </motion.div>
    </motion.button>
    </li>
  );
}

function StepConnector({ isComplete, motionEnabled }) {
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = !motionEnabled || systemReducedMotion;
  const lineVariants = {
    incomplete: { width: 0, backgroundColor: 'transparent' },
    complete: { width: '100%', backgroundColor: '#5227FF' }
  };

  return (
    <li className="step-connector" role="presentation" aria-hidden="true">
      <motion.div
        className="step-connector-inner"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: reducedMotion ? 0 : 0.4 }}
      />
    </li>
  );
}

function CheckIcon(props) {
  const reducedMotion = useReducedMotion();
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: reducedMotion ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: reducedMotion ? 0 : 0.1, type: 'tween', ease: 'easeOut', duration: reducedMotion ? 0 : 0.3 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
