/**
 * Datos de demostración para el modo offline/demo.
 * Estos valores son ficticios y sólo tienen fines didácticos.
 */

export const PADRON_DEMO = [
  { cuit: '20123456789', razon_social: 'GARCIA PABLO NICOLAS',         actividad: '621100', alicuota: 0.03   },
  { cuit: '20234567890', razon_social: 'LOPEZ MARIA VICTORIA',          actividad: '472100', alicuota: 0.025  },
  { cuit: '27345678901', razon_social: 'FERNANDEZ ANA LAURA',           actividad: '620100', alicuota: 0.03   },
  { cuit: '30456789012', razon_social: 'DISTRIBUIDORA NORTE S.R.L.',    actividad: '464100', alicuota: 0.02   },
  { cuit: '30567890123', razon_social: 'COMERCIAL DEL SUR S.A.',        actividad: '471100', alicuota: 0.025  },
  { cuit: '20678901234', razon_social: 'MARTINEZ CARLOS ALBERTO',       actividad: '561000', alicuota: 0.015  },
  { cuit: '27789012345', razon_social: 'RODRIGUEZ JULIA INES',          actividad: '620100', alicuota: 0.03   },
  { cuit: '30890123456', razon_social: 'TECNOLOGIA APLICADA S.A.',      actividad: '620200', alicuota: 0.03   },
  { cuit: '20901234567', razon_social: 'PEREZ JUAN MANUEL',             actividad: '452000', alicuota: 0.02   },
  { cuit: '27012345678', razon_social: 'GOMEZ SILVIA BEATRIZ',          actividad: '960100', alicuota: 0.015  },
  { cuit: '30123456781', razon_social: 'SOLUCIONES INTEGRALES S.R.L.',  actividad: '620100', alicuota: 0.03   },
  { cuit: '20234567891', razon_social: 'DIAZ ROBERTO OSCAR',            actividad: '431000', alicuota: 0.02   },
  { cuit: '27345678902', razon_social: 'SANTOS CAROLINA ELENA',         actividad: '477000', alicuota: 0.025  },
  { cuit: '30456789013', razon_social: 'IMPORTADORA REGIONAL S.A.',     actividad: '461000', alicuota: 0.02   },
  { cuit: '20567890124', razon_social: 'ALVAREZ DANIEL HORACIO',        actividad: '620100', alicuota: 0.03   },
  { cuit: '27678901235', razon_social: 'TORRES MARCELA ANDREA',         actividad: '477000', alicuota: 0.025  },
  { cuit: '30789012346', razon_social: 'CONSTRUCTORA PAMPEANA S.A.',    actividad: '410000', alicuota: 0.02   },
  { cuit: '20890123457', razon_social: 'REYES MIGUEL ANGEL',            actividad: '561000', alicuota: 0.015  },
  { cuit: '27901234568', razon_social: 'MORALES PATRICIA SUSANA',       actividad: '960200', alicuota: 0.015  },
  { cuit: '30012345679', razon_social: 'AGROPECUARIA DEL ESTE S.R.L.',  actividad: '011000', alicuota: 0.01   },
];

export const DEFAULT_FISCAL_APPS = { arba_iibb: true, arca_facturacion: false };

export const INITIAL_PERCEPCIONES_DEMO = [
  {
    id: '1',
    id_venta: 'VTA-DEMO-001',
    cuit: '20123456789',
    monto_venta: 50000,
    alicuota_aplicada: 0.03,
    monto_percepcion: 1500,
    fecha: '2025-10-01T10:00:00.000Z',
    origen: 'Demo',
  },
  {
    id: '2',
    id_venta: 'VTA-DEMO-002',
    cuit: '30456789012',
    monto_venta: 120000,
    alicuota_aplicada: 0.02,
    monto_percepcion: 2400,
    fecha: '2025-10-02T14:30:00.000Z',
    origen: 'Demo',
  },
  {
    id: '3',
    id_venta: 'VTA-DEMO-003',
    cuit: '27345678901',
    monto_venta: 85000,
    alicuota_aplicada: 0.03,
    monto_percepcion: 2550,
    fecha: '2025-10-03T09:15:00.000Z',
    origen: 'Demo',
  },
];
