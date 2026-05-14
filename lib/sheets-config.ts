export interface SheetConfig {
  id: string
  tabName: string
  label: string
  category: 'finanzas' | 'flujo' | 'resultados'
  dataRange: string
}

export const SHEETS_CONFIG: SheetConfig[] = [
  {
    id: '1PiQ_h_bl4CNWm9npNlNLgT8jeaj98kojR7vWU3QMGeU',
    tabName: 'SF',
    label: 'Balance General',
    category: 'finanzas',
    dataRange: 'B5:T31',
  },
  {
    id: '1PiQ_h_bl4CNWm9npNlNLgT8jeaj98kojR7vWU3QMGeU',
    tabName: 'deuda',
    label: 'Deudas',
    category: 'finanzas',
    dataRange: 'A3:D7',
  },
  {
    id: '1w2dktJCQdWwtxREPuWDOSEBS8YVD6bpTJbCfvmWJe4A',
    tabName: 'ACTUAL',
    label: 'Punto de Equilibrio',
    category: 'finanzas',
    dataRange: 'A1:M20',
  },
  {
    id: '15Hd1R-HNVYXaPvGEG6NeDePrQCBj_y_x4rlZVEawax4',
    tabName: 'resumen',
    label: 'Flujo de Efectivo',
    category: 'flujo',
    dataRange: 'A3:N76',
  },
  {
    id: '1XxPcgdt5EYNWwOwVCAo3u8z3HXBVSk2lP94UQ5QE1jw',
    tabName: 'FLUJO',
    label: 'Flujo de Caja',
    category: 'flujo',
    dataRange: 'A3:K17',
  },
  {
    id: '1XxPcgdt5EYNWwOwVCAo3u8z3HXBVSk2lP94UQ5QE1jw',
    tabName: 'pago recurrente',
    label: 'Pagos Programados',
    category: 'flujo',
    dataRange: 'A5:Z10',
  },
  {
    id: '1IFuxl5pCACE9ofuld24pwJLBhmWYzOWQSuogns_ehLs',
    tabName: 'ER',
    label: 'Estado de Resultados',
    category: 'resultados',
    dataRange: 'A6:O40',
  },
  {
    id: '1GtiQgffOALa1XdP1nhjDXUwOirxXDEN_xPWj6FDp07k',
    tabName: 'Unidos',
    label: 'Presupuesto',
    category: 'resultados',
    dataRange: 'A4:BF14',
  },
  {
    id: '1CKslVlqp8g6DnxmALvwon-KV4gbfsHY5m9gnqaCcN0c',
    tabName: 'SSGG',
    label: 'Ventas SSGG',
    category: 'resultados',
    dataRange: 'A2:N3',
  },
  {
    id: '1CKslVlqp8g6DnxmALvwon-KV4gbfsHY5m9gnqaCcN0c',
    tabName: 'HVAC',
    label: 'Ventas HVAC',
    category: 'resultados',
    dataRange: 'A2:N3',
  },
  {
    id: '1CKslVlqp8g6DnxmALvwon-KV4gbfsHY5m9gnqaCcN0c',
    tabName: 'ADI',
    label: 'Ventas ADI',
    category: 'resultados',
    dataRange: 'A2:N3',
  },
]
