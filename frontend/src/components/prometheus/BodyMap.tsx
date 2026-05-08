import Body from 'react-muscle-highlighter';
import type { ExtendedBodyPart } from 'react-muscle-highlighter';
import {
  RECOVERY_COLORS,
  SLUG_TO_INTERNAL,
  recoveryMapToBodyParts,
  type MuscleKey,
  type RecoveryMap,
} from '../../types/prometheus';

interface BodyMapProps {
  recoveryMap: RecoveryMap;
  side: 'front' | 'back';
  onMuscleClick?: (muscleKey: MuscleKey) => void;
}

export default function BodyMap({ recoveryMap, side, onMuscleClick }: BodyMapProps) {
  const data: ExtendedBodyPart[] = recoveryMapToBodyParts(recoveryMap);

  return (
    <div className="flex justify-center">
      <Body
        data={data}
        side={side}
        gender="male"
        scale={1.5}
        colors={[...RECOVERY_COLORS]}
        defaultFill="#262636"
        defaultStroke="#1A1A24"
        onBodyPartPress={(part) => {
          const slug = part.slug;
          if (!slug || !onMuscleClick) return;
          const internal = SLUG_TO_INTERNAL[slug];
          if (internal) onMuscleClick(internal);
        }}
      />
    </div>
  );
}
