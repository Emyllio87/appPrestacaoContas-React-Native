import Svg, { Rect, Circle, Path, Line } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface LogoAppProps {
  size?: number;
}

export function LogoApp({ size = 80 }: LogoAppProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Fundo arredondado azul */}
      <Rect x="0" y="0" width="120" height="120" rx="28" fill={COLORS.primary} />

      {/* Papel / recibo branco */}
      <Rect x="30" y="22" width="60" height="78" rx="6" fill="#FFFFFF" />

      {/* Linhas do recibo */}
      <Line x1="40" y1="40" x2="80" y2="40" stroke={COLORS.border} strokeWidth="4" strokeLinecap="round" />
      <Line x1="40" y1="52" x2="80" y2="52" stroke={COLORS.border} strokeWidth="4" strokeLinecap="round" />
      <Line x1="40" y1="64" x2="64" y2="64" stroke={COLORS.border} strokeWidth="4" strokeLinecap="round" />

      {/* Selo de "concluído" */}
      <Circle cx="86" cy="90" r="19" fill={COLORS.success} />
      <Path
        d="M78 90 L84 96 L96 81"
        stroke="#FFFFFF"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
