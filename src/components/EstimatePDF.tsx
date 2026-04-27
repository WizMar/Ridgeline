import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Estimate, EstimateTotals } from '@/types/estimate'

export type PDFCompanyInfo = {
  name: string
  phone: string
  email: string
  address: string
  website: string
  logoUrl: string
  license: string
}

// ── Palette (matches app's stone/zinc theme) ─────────────────────────────────
const STONE       = '#78716C'   // stone-500
const STONE_DARK  = '#44403C'   // stone-700
const DARK        = '#1C1917'   // stone-900
const STONE_LIGHT = '#F5F5F4'   // stone-100
const BORDER      = '#E7E5E4'   // stone-200
const MUTED       = '#A8A29E'   // stone-400
const WHITE       = '#FFFFFF'
const ACCENT      = '#D97706'   // amber-600 — kept for $ totals only

const s = StyleSheet.create({
  page: {
    paddingTop: 0, paddingBottom: 60, paddingHorizontal: 0,
    fontFamily: 'Helvetica', fontSize: 9, color: DARK, backgroundColor: WHITE,
  },

  // ── Header band ─────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: DARK,
    paddingTop: 32, paddingBottom: 28,
    paddingHorizontal: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: { width: 100, height: 40, objectFit: 'contain' },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: WHITE, marginBottom: 4 },
  companyLine: { fontSize: 8, color: MUTED, marginBottom: 2 },

  estimateLabel: {
    fontSize: 28, fontFamily: 'Helvetica-Bold', color: WHITE,
    textAlign: 'right', letterSpacing: 2,
  },
  estimateNum: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', color: STONE,
    textAlign: 'right', marginTop: 4,
  },

  // ── Accent stripe ────────────────────────────────────────────────────────────
  accentStripe: { height: 4, backgroundColor: STONE },

  // ── Meta ribbon ─────────────────────────────────────────────────────────────
  metaRibbon: {
    backgroundColor: STONE_LIGHT,
    paddingVertical: 10, paddingHorizontal: 44,
    flexDirection: 'row', gap: 24,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: STONE_DARK },
  statusPill: {
    backgroundColor: STONE, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 0.6 },

  // ── Body padding ─────────────────────────────────────────────────────────────
  body: { paddingHorizontal: 44, paddingTop: 24 },

  // ── Info columns ─────────────────────────────────────────────────────────────
  cols3: { flexDirection: 'row', marginBottom: 24, gap: 12 },
  infoCard: {
    flex: 1,
    borderLeftWidth: 2, borderLeftColor: STONE,
    paddingLeft: 10,
  },
  infoLabel: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: STONE,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5,
  },
  infoPrimary: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  infoLine: { fontSize: 8.5, color: STONE_DARK, marginBottom: 1.5 },
  infoMuted: { fontSize: 8, color: MUTED, marginBottom: 1.5 },

  // ── Section heading ───────────────────────────────────────────────────────────
  sectionHeading: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: STONE,
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8,
  },

  // ── Scope ─────────────────────────────────────────────────────────────────────
  scopeBox: {
    backgroundColor: STONE_LIGHT, borderRadius: 4,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: STONE,
  },
  scopeText: { fontSize: 9, color: DARK, lineHeight: 1.6 },

  // ── Tables ────────────────────────────────────────────────────────────────────
  tableWrap: { marginBottom: 18 },
  tHead: {
    flexDirection: 'row',
    backgroundColor: DARK,
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 3,
  },
  tHeadText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 0.3 },
  tRow: {
    flexDirection: 'row',
    paddingVertical: 7, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  tRowAlt: { backgroundColor: STONE_LIGHT },
  tCell: { fontSize: 9, color: DARK },
  tCellMuted: { fontSize: 8.5, color: MUTED },

  // ── Totals ────────────────────────────────────────────────────────────────────
  totalsWrap: { alignItems: 'flex-end', marginBottom: 24 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 230, marginBottom: 4 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, color: DARK },
  dividerThin: { width: 230, borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 6 },
  grandBox: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: 230, backgroundColor: DARK,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 4, marginTop: 4,
  },
  grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 1 },
  grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: ACCENT },

  // ── Notes ─────────────────────────────────────────────────────────────────────
  notesBox: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 24,
  },
  notesText: { fontSize: 8.5, color: STONE_DARK, lineHeight: 1.55 },

  // ── Signature block ───────────────────────────────────────────────────────────
  signatureSection: {
    marginTop: 8,
    borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 18,
  },
  signatureHeading: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: STONE,
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10,
  },
  signatureGrid: { flexDirection: 'row', gap: 24 },
  signatureCol: { flex: 1 },
  signatureLine: {
    borderBottomWidth: 1, borderBottomColor: DARK, marginBottom: 4, height: 28,
  },
  signatureLineLabel: { fontSize: 7.5, color: MUTED },
  signatureNote: { fontSize: 7.5, color: MUTED, marginTop: 10, lineHeight: 1.5 },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 20, left: 44, right: 44,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 7,
  },
  footerText: { fontSize: 7, color: MUTED },
})

function usd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function validUntil(iso: string) {
  const d = new Date(iso)
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

type Props = {
  estimate: Estimate
  totals: EstimateTotals
  company: PDFCompanyInfo
}

export function EstimatePDF({ estimate, totals, company }: Props) {
  const date = fmtDate(estimate.createdAt)
  const liDescriptions = new Set(estimate.lineItems.map(li => li.description || 'Line Item'))
  const tradeRows = totals.breakdown.filter(b => !liDescriptions.has(b.label))
  const lineRows  = totals.breakdown.filter(b =>  liDescriptions.has(b.label))
  const hasLineItems = estimate.lineItems.length > 0

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── Header band ──────────────────────────────────────────────────── */}
        <View style={s.headerBand}>
          <View>
            {company.logoUrl
              ? <Image src={company.logoUrl} style={s.logo} />
              : <Text style={s.companyName}>{company.name || 'Your Company'}</Text>
            }
            {company.logoUrl && company.name
              ? <Text style={[s.companyName, { marginTop: 4 }]}>{company.name}</Text>
              : null
            }
            {company.address ? <Text style={s.companyLine}>{company.address}</Text> : null}
            {company.phone   ? <Text style={s.companyLine}>{company.phone}</Text>   : null}
            {company.email   ? <Text style={s.companyLine}>{company.email}</Text>   : null}
            {company.license ? <Text style={s.companyLine}>Lic #{company.license}</Text> : null}
          </View>
          <View>
            <Text style={s.estimateLabel}>ESTIMATE</Text>
            <Text style={s.estimateNum}>{estimate.estimateNumber}</Text>
          </View>
        </View>

        {/* ── Accent stripe ────────────────────────────────────────────────── */}
        <View style={s.accentStripe} />

        {/* ── Meta ribbon ──────────────────────────────────────────────────── */}
        <View style={s.metaRibbon}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{date}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Valid Until</Text>
            <Text style={s.metaValue}>{validUntil(estimate.createdAt)}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Type</Text>
            <Text style={s.metaValue}>{estimate.jobType}</Text>
          </View>
          {estimate.status !== 'Draft' && (
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Status</Text>
              <View style={s.statusPill}>
                <Text style={s.statusPillText}>{estimate.status}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.body}>

          {/* ── Bill To / Property / Prepared By ─────────────────────────── */}
          <View style={s.cols3}>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Bill To</Text>
              <Text style={s.infoPrimary}>{estimate.client.name || '—'}</Text>
              {estimate.client.phone ? <Text style={s.infoMuted}>{estimate.client.phone}</Text> : null}
              {estimate.client.email ? <Text style={s.infoMuted}>{estimate.client.email}</Text> : null}
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Job Address</Text>
              {estimate.address
                ? estimate.address.split(',').map((part, i) => (
                    <Text key={i} style={i === 0 ? s.infoPrimary : s.infoMuted}>{part.trim()}</Text>
                  ))
                : <Text style={s.infoMuted}>—</Text>
              }
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Prepared By</Text>
              <Text style={s.infoPrimary}>{company.name || '—'}</Text>
              {company.phone   ? <Text style={s.infoMuted}>{company.phone}</Text>   : null}
              {company.email   ? <Text style={s.infoMuted}>{company.email}</Text>   : null}
              {company.website ? <Text style={s.infoMuted}>{company.website}</Text> : null}
            </View>
          </View>

          {/* ── Scope of Work ─────────────────────────────────────────────── */}
          {estimate.scope ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={s.sectionHeading}>Scope of Work</Text>
              <View style={s.scopeBox}>
                <Text style={s.scopeText}>{estimate.scope}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Cost Summary ──────────────────────────────────────────────── */}
          {tradeRows.length > 0 && (
            <View style={s.tableWrap}>
              <Text style={s.sectionHeading}>Cost Summary</Text>
              <View style={s.tHead}>
                <Text style={[s.tHeadText, { flex: 1 }]}>Description</Text>
                <Text style={[s.tHeadText, { width: 100, textAlign: 'right' }]}>Amount</Text>
              </View>
              {tradeRows.map((row, i) => (
                <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
                  <Text style={[s.tCell, { flex: 1 }]}>{row.label}</Text>
                  <Text style={[s.tCell, { width: 100, textAlign: 'right' }]}>{usd(row.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Line Items ────────────────────────────────────────────────── */}
          {hasLineItems && (
            <View style={s.tableWrap}>
              <Text style={s.sectionHeading}>Materials &amp; Additional Items</Text>
              <View style={s.tHead}>
                <Text style={[s.tHeadText, { flex: 1 }]}>Item</Text>
                <Text style={[s.tHeadText, { width: 32, textAlign: 'right' }]}>Qty</Text>
                <Text style={[s.tHeadText, { width: 32, textAlign: 'right' }]}>Unit</Text>
                <Text style={[s.tHeadText, { width: 70, textAlign: 'right' }]}>Unit Price</Text>
                <Text style={[s.tHeadText, { width: 70, textAlign: 'right' }]}>Total</Text>
              </View>
              {estimate.lineItems.map((li, i) => (
                <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
                  <Text style={[s.tCell, { flex: 1 }]}>{li.description}</Text>
                  <Text style={[s.tCellMuted, { width: 32, textAlign: 'right' }]}>{li.qty}</Text>
                  <Text style={[s.tCellMuted, { width: 32, textAlign: 'right' }]}>{li.unit}</Text>
                  <Text style={[s.tCellMuted, { width: 70, textAlign: 'right' }]}>{usd(li.unitPrice)}</Text>
                  <Text style={[s.tCell,      { width: 70, textAlign: 'right' }]}>{usd(li.qty * li.unitPrice)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Totals ────────────────────────────────────────────────────── */}
          {totals.total > 0 && (
            <View style={s.totalsWrap}>
              {(tradeRows.length > 0 || lineRows.length > 0) && (
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Subtotal</Text>
                  <Text style={s.totalValue}>{usd(totals.subtotal)}</Text>
                </View>
              )}
              {totals.markup > 0 && (
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Markup ({totals.markupPct}%)</Text>
                  <Text style={s.totalValue}>{usd(totals.markup)}</Text>
                </View>
              )}
              <View style={s.dividerThin} />
              <View style={s.grandBox}>
                <Text style={s.grandLabel}>TOTAL</Text>
                <Text style={s.grandValue}>{usd(totals.total)}</Text>
              </View>
            </View>
          )}

          {/* ── Notes ─────────────────────────────────────────────────────── */}
          {estimate.notes ? (
            <View style={{ marginBottom: 24 }}>
              <Text style={s.sectionHeading}>Notes</Text>
              <View style={s.notesBox}>
                <Text style={s.notesText}>{estimate.notes}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Acceptance / Signature ────────────────────────────────────── */}
          <View style={s.signatureSection}>
            <Text style={s.signatureHeading}>Acceptance &amp; Authorization</Text>
            <View style={s.signatureGrid}>
              <View style={s.signatureCol}>
                <View style={s.signatureLine} />
                <Text style={s.signatureLineLabel}>Client Signature</Text>
              </View>
              <View style={s.signatureCol}>
                <View style={s.signatureLine} />
                <Text style={s.signatureLineLabel}>Printed Name</Text>
              </View>
              <View style={s.signatureCol}>
                <View style={s.signatureLine} />
                <Text style={s.signatureLineLabel}>Date</Text>
              </View>
            </View>
            <Text style={s.signatureNote}>
              By signing above, you authorize {company.name || 'the contractor'} to perform the work described in this estimate at the total price stated. This estimate is valid for 30 days from the date of issue.
            </Text>
          </View>

        </View>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{company.name || 'Nexus'} · {estimate.estimateNumber}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
