import { Icon } from '@iconify/react'
import { Button, Popover } from 'antd'
import { useEffect, useState } from 'react'

/** Danh sách mdi: — một lưới; Iconify tải SVG theo nhu cầu. */
const MDI_ICONS: string[] = [
  'mdi:account-group-outline',
  'mdi:account-multiple-outline',
  'mdi:airplane',
  'mdi:airballoon-outline',
  'mdi:alarm-light-outline',
  'mdi:ambulance',
  'mdi:archive-outline',
  'mdi:arm-flex-outline',
  'mdi:baby-face-outline',
  'mdi:bag-personal-outline',
  'mdi:bank-outline',
  'mdi:barrel-outline',
  'mdi:beach',
  'mdi:beer-outline',
  'mdi:bike',
  'mdi:book-open-variant',
  'mdi:book-outline',
  'mdi:briefcase-outline',
  'mdi:brush-outline',
  'mdi:bus-side',
  'mdi:cake-variant-outline',
  'mdi:calculator-variant',
  'mdi:calendar-month-outline',
  'mdi:camera-outline',
  'mdi:car-side',
  'mdi:card-account-details-outline',
  'mdi:cash-multiple',
  'mdi:chart-line',
  'mdi:chart-pie-outline',
  'mdi:chat-outline',
  'mdi:check-decagram-outline',
  'mdi:chef-hat',
  'mdi:church-outline',
  'mdi:clipboard-list-outline',
  'mdi:clock-outline',
  'mdi:cloud-outline',
  'mdi:coffee-outline',
  'mdi:cog-outline',
  'mdi:credit-card-outline',
  'mdi:cup-outline',
  'mdi:currency-usd',
  'mdi:dog-side',
  'mdi:dumbbell',
  'mdi:earth',
  'mdi:email-outline',
  'mdi:emoticon-happy-outline',
  'mdi:factory',
  'mdi:filmstrip',
  'mdi:fire',
  'mdi:flag-outline',
  'mdi:flash-outline',
  'mdi:flower-outline',
  'mdi:food',
  'mdi:food-apple-outline',
  'mdi:food-drumstick-outline',
  'mdi:food-takeout-box-outline',
  'mdi:football',
  'mdi:forum-outline',
  'mdi:gamepad-variant-outline',
  'mdi:gas-station-outline',
  'mdi:gift-outline',
  'mdi:glass-wine',
  'mdi:guitar-electric',
  'mdi:hammer-wrench',
  'mdi:headphones',
  'mdi:heart-outline',
  'mdi:heart-pulse',
  'mdi:home-outline',
  'mdi:hospital-box-outline',
  'mdi:ice-cream',
  'mdi:image-outline',
  'mdi:invoice-text-outline',
  'mdi:key-outline',
  'mdi:laptop',
  'mdi:leaf',
  'mdi:lightbulb-outline',
  'mdi:lightning-bolt-outline',
  'mdi:lock-outline',
  'mdi:map-marker-outline',
  'mdi:medical-bag',
  'mdi:microphone-outline',
  'mdi:monitor',
  'mdi:moon-waning-crescent',
  'mdi:motorbike',
  'mdi:movie-open-outline',
  'mdi:music-note',
  'mdi:numeric',
  'mdi:office-building-outline',
  'mdi:package-variant-closed',
  'mdi:palette-outline',
  'mdi:party-popper',
  'mdi:paw',
  'mdi:phone-outline',
  'mdi:pill',
  'mdi:pizza',
  'mdi:playlist-music',
  'mdi:puzzle-outline',
  'mdi:receipt-text-outline',
  'mdi:robot-outline',
  'mdi:rocket-launch-outline',
  'mdi:run',
  'mdi:school-outline',
  'mdi:scissors-cutting',
  'mdi:shield-check-outline',
  'mdi:shopping-outline',
  'mdi:shower',
  'mdi:ski',
  'mdi:smoking-off',
  'mdi:snowflake',
  'mdi:soccer',
  'mdi:sofa-outline',
  'mdi:sparkles',
  'mdi:star-outline',
  'mdi:storefront-outline',
  'mdi:subway-variant',
  'mdi:sun-wireless-outline',
  'mdi:swap-horizontal',
  'mdi:tag-outline',
  'mdi:terrain',
  'mdi:theater',
  'mdi:thumb-up-outline',
  'mdi:tools',
  'mdi:train',
  'mdi:translate',
  'mdi:trophy-outline',
  'mdi:truck-outline',
  'mdi:tshirt-crew-outline',
  'mdi:umbrella-outline',
  'mdi:video-outline',
  'mdi:wallet-outline',
  'mdi:washing-machine',
  'mdi:water-outline',
  'mdi:weather-cloudy',
  'mdi:weight-kilogram',
  'mdi:wifi',
  'mdi:wrench-outline',
]

const PRESET_COLORS = [
  '#0073AA',
  '#005A87',
  '#D54E21',
  '#2271B1',
  '#00A32A',
  '#DB2777',
  '#DC2626',
  '#EA580C',
  '#D97706',
  '#65A30D',
  '#059669',
  '#0891B2',
  '#0284C7',
  '#8B5CF6',
  '#646970',
  '#1D2327',
]

function isIconifyId(s: string) {
  return s.includes(':')
}

export interface IconPickerValue {
  icon: string
  color: string
}

interface IconPickerProps {
  value?: IconPickerValue
  onChange?: (v: IconPickerValue) => void
  size?: number
}

export function IconPicker({ value, onChange, size = 40 }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState(value?.icon ?? 'mdi:wallet-outline')
  const [selectedColor, setSelectedColor] = useState(value?.color ?? '#0073AA')

  useEffect(() => {
    if (value?.icon != null) setSelectedIcon(value.icon)
    if (value?.color != null) setSelectedColor(value.color)
  }, [value?.icon, value?.color])

  const handleSelectIcon = (icon: string) => {
    setSelectedIcon(icon)
    onChange?.({ icon, color: selectedColor })
  }

  const content = (
    <div className="w-[min(100vw-32px,380px)]">
      <div
        className="grid grid-cols-8 gap-1 overflow-y-auto py-0.5 [scrollbar-width:thin]"
        style={{ maxHeight: 280 }}
      >
        {MDI_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            title={icon.replace('mdi:', '').replace(/-/g, ' ')}
            onClick={() => handleSelectIcon(icon)}
            className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
            style={{
              border:
                selectedIcon === icon ? `2px solid ${selectedColor}` : '2px solid transparent',
              background: selectedIcon === icon ? `${selectedColor}18` : 'transparent',
            }}
          >
            <Icon
              icon={icon}
              width={22}
              color={selectedIcon === icon ? selectedColor : '#57534e'}
            />
          </button>
        ))}
      </div>

      <div className="mt-3 border-t border-[--color-border-light] pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Màu sắc
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => {
                setSelectedColor(color)
                onChange?.({ icon: selectedIcon, color })
              }}
              className="h-6 w-6 shrink-0 rounded-md border-2 transition-all"
              style={{
                background: color,
                borderColor: selectedColor === color ? '#fff' : 'transparent',
                outline: selectedColor === color ? `2px solid ${color}` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <Button type="primary" block size="small" className="mt-3" onClick={() => setOpen(false)}>
        Xong
      </Button>
    </div>
  )

  const current = value ?? { icon: selectedIcon, color: selectedColor }

  return (
    <Popover content={content} title="Chọn icon" trigger="click" open={open} onOpenChange={setOpen}>
      <button
        type="button"
        style={{
          width: size,
          height: size,
          background: `${current.color}20`,
          border: `2px dashed ${current.color}60`,
          borderRadius: size * 0.28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontSize: size * 0.48,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderStyle = 'solid'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderStyle = 'dashed'
        }}
      >
        {isIconifyId(current.icon) ? (
          <Icon icon={current.icon} color={current.color} width={size * 0.52} />
        ) : (
          current.icon
        )}
      </button>
    </Popover>
  )
}
