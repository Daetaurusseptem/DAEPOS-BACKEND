export interface StripeProduct {
    id: string
    object: string
    active: boolean
    created: number
    default_price: string
    description: string
    features: Feature[]
    images: string[]
    livemode: boolean
    name: string
    package_dimensions: any
    shippable: any
    statement_descriptor: string
    tax_code: any
    unit_label: any
    updated: number
    url: any
  }
  export interface Feature {
    name: string
  }
export interface StripePrice {
    id: string
    object: string
    active: boolean
    billing_scheme: string
    created: number
    currency: string
    custom_unit_amount: any
    livemode: boolean
    lookup_key: any
    nickname: any
    product: string
    recurring: 'month',
    tax_behavior: string
    tiers_mode: any
    transform_quantity: any
    type: string
    unit_amount: number
    unit_amount_decimal: string
  }
