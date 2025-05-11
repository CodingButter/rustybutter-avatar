// Shared types for RustyButter Avatar

// Expression interface
export interface Expression {
  name: string;
  imageUrl: string;
  description: string;
  useCases: string;
}

// Avatar state interface
export interface AvatarState {
  direction: 'right' | 'left';
  posX: number;
  posY: number;
  rotation: number;
  scale: number;
}

// Expression action interface for batch expressions
export interface ExpressionAction extends AvatarState {
  expression: string;
  duration: number; // Duration in milliseconds
}

// Batch expressions interface
export interface BatchExpressions {
  loop: boolean;
  random?: boolean; // Flag to indicate if the expressions should be played in random order
  actions: ExpressionAction[];
  batchId: string; // Unique identifier for the batch
}