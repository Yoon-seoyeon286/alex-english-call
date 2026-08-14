import { Pressable, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

type IconName = 'mic' | 'mic-off' | 'transcript' | 'hint';

function Icon({ name, color }: { name: IconName; color: string }) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    // Without this the SVG host view swallows the touch on the New
    // Architecture and the parent Pressable never fires.
    <Svg width={24} height={24} viewBox="0 0 24 24" pointerEvents="none">
      {name === 'mic' || name === 'mic-off' ? (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...common} />
          <Path d="M5 11a7 7 0 0 0 14 0" {...common} />
          <Line x1={12} y1={18} x2={12} y2={21} {...common} />
          {name === 'mic-off' ? <Line x1={4} y1={4} x2={20} y2={20} {...common} /> : null}
        </>
      ) : null}

      {name === 'transcript' ? (
        <>
          <Path d="M4 5h16v11H9l-5 4V5z" {...common} />
          <Line x1={8} y1={9} x2={16} y2={9} {...common} />
          <Line x1={8} y1={12.5} x2={13} y2={12.5} {...common} />
        </>
      ) : null}

      {name === 'hint' ? (
        <>
          <Path d="M9 17h6M10 20h4" {...common} />
          <Path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.6h5.6c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" {...common} />
        </>
      ) : null}
    </Svg>
  );
}

interface ControlButtonProps {
  label: string;
  icon: IconName;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function ControlButton({ label, icon, active, disabled, onPress }: ControlButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      onPress={disabled ? undefined : onPress}
      className="items-center"
      hitSlop={12}
      // Press feedback has to live on the Pressable itself — a NativeWind
      // `active:` on the child View never sees the press state.
      style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}
    >
      <View
        pointerEvents="none"
        className={`h-16 w-16 items-center justify-center rounded-full ${
          active ? 'bg-white' : 'bg-ink-700'
        }`}
      >
        <Icon name={icon} color={active ? '#08090C' : '#FFFFFF'} />
      </View>
      <Text className="mt-2 text-[11px] text-muted">{label}</Text>
    </Pressable>
  );
}

interface CallControlsProps {
  muted: boolean;
  disabled: boolean;
  onToggleMute: () => void;
  onToggleTranscript: () => void;
  onHint: () => void;
  onEndCall: () => void;
  transcriptOpen: boolean;
}

export function CallControls({
  muted,
  disabled,
  onToggleMute,
  onToggleTranscript,
  onHint,
  onEndCall,
  transcriptOpen,
}: CallControlsProps) {
  return (
    <View>
      <View className="flex-row items-start justify-around px-2">
        <ControlButton
          label={muted ? 'Unmute' : 'Mute'}
          icon={muted ? 'mic-off' : 'mic'}
          active={muted}
          disabled={disabled}
          onPress={onToggleMute}
        />
        <ControlButton
          label="Transcript"
          icon="transcript"
          active={transcriptOpen}
          onPress={onToggleTranscript}
        />
        <ControlButton label="Hint" icon="hint" disabled={disabled} onPress={onHint} />
      </View>

      {/* Always enabled — hanging up must work even while connecting. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End call"
        onPress={onEndCall}
        className="mt-7 h-16 items-center justify-center rounded-full bg-danger active:opacity-80"
      >
        <Text className="text-lg font-semibold text-white">End Call</Text>
      </Pressable>
    </View>
  );
}
