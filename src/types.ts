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