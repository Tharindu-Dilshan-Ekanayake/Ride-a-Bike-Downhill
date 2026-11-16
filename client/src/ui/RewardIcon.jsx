import Icon from './Icon'

/**
 * Icon for a reward table entry or a reward grant: an icon name ('coin', 'potionWins',
 * 'potionBoost', 'bike:<color>'...). Item ids double as their icon names.
 */
export function RewardIcon({ icon, size }) {
  return <Icon name={icon || 'coin'} size={size} />
}

export default RewardIcon
