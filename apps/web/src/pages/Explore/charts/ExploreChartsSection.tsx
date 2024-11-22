import { ChartHeader } from 'components/Charts/ChartHeader'
import { Chart } from 'components/Charts/ChartModel'
import { ChartSkeleton } from 'components/Charts/LoadingState'
import { TVLChartModel } from 'components/Charts/StackedLineChart'
import TimePeriodSelector from 'components/Charts/TimeSelector'
import { formatHistoryDuration } from 'components/Charts/VolumeChart'
import { CustomVolumeChartModel } from 'components/Charts/VolumeChart/CustomVolumeChartModel'
import { StackedHistogramData } from 'components/Charts/VolumeChart/renderer'
import { getCumulativeSum, getCumulativeVolume, getVolumeProtocolInfo } from 'components/Charts/VolumeChart/utils'
import { ChartType } from 'components/Charts/utils'
import Column from 'components/Column'
import { RowBetween } from 'components/Row'
import { DataQuality } from 'components/Tokens/TokenDetails/ChartSection/util'
import { MAX_WIDTH_MEDIA_BREAKPOINT } from 'components/Tokens/constants'
import { SupportedInterfaceChainId, chainIdToBackendChain, useChainFromUrlParam } from 'constants/chains'
import { useDailyProtocolTVL, useHistoricalProtocolVolume } from 'graphql/data/protocolStats'
import { TimePeriod, getProtocolColor, getSupportedGraphQlChain } from 'graphql/data/util'
import { useScreenSize } from 'hooks/screenSize'
import { Trans } from 'i18n'
import { ReactNode, useMemo, useState } from 'react'
import styled, { useTheme } from 'styled-components'
import { EllipsisStyle, ThemedText } from 'theme/components'
import { HistoryDuration, PriceSource } from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { NumberType, useFormatter } from 'utils/formatNumbers'

const EXPLORE_CHART_HEIGHT_PX = 368
const EXPLORE_PRICE_SOURCES = [PriceSource.SubgraphV2, PriceSource.SubgraphV3]

const TIME_SELECTOR_OPTIONS = [
  { time: TimePeriod.DAY, display: 'D' },
  { time: TimePeriod.WEEK, display: 'W' },
  { time: TimePeriod.MONTH, display: 'M' },
]

const StyledTimePeriodSelector = styled(TimePeriodSelector)`
  & > button {
    padding: 4px 8px;
    margin: 4px 0px;
    font-size: 14px;
  }
`
const ChartsContainer = styled(RowBetween)`
  max-width: ${MAX_WIDTH_MEDIA_BREAKPOINT};
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-bottom: 56px;
`
// a 6% gap is achieved using two 47% width containers, as a parent gap causes an autosizing error with side-by-side lightweight-charts
const SectionContainer = styled(Column)`
  position: relative;
  width: 47%;
  gap: 4px;

  > * {
    ${EllipsisStyle}
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    background-color: ${({ theme }) => theme.surface2};
    border-radius: 20px;
    height: 120px;
    padding: 20px;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.xs}px`}) {
    height: 112px;
    padding: 16px;
  }
`
const SectionTitle = styled(ThemedText.SubHeader)`
  color: ${({ theme }) => theme.neutral2};
  white-space: nowrap;
`
const StyledChart: typeof Chart = styled(Chart)`
  height: ${EXPLORE_CHART_HEIGHT_PX}px;
`

function VolumeChartSection({ chainId }: { chainId: SupportedInterfaceChainId }) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(TimePeriod.DAY)
  const theme = useTheme()
  const isSmallScreen = !useScreenSize()['sm']

  function timeGranularityToHistoryDuration(timePeriod: TimePeriod): HistoryDuration {
    // note: timePeriod on the Explore Page represents the GRANULARITY, not the timespan of data shown.
    // i.e. timePeriod == D shows 1month data, timePeriod == W shows 1year data, timePeriod == M shows past 3Y data
    switch (timePeriod) {
      case TimePeriod.DAY:
      default:
        return HistoryDuration.Month
      case TimePeriod.WEEK:
        return HistoryDuration.Year
      case TimePeriod.MONTH:
        return HistoryDuration.Max
    }
  }

  const { entries, loading, dataQuality } = useHistoricalProtocolVolume(
    chainIdToBackendChain({ chainId, withFallback: true }),
    isSmallScreen ? HistoryDuration.Month : timeGranularityToHistoryDuration(timePeriod)
  )

  const params = useMemo<{ data: StackedHistogramData[]; colors: [string, string]; headerHeight: number }>(
    () => ({
      data: entries,
      colors: [theme.accent1, theme.accent3],
      headerHeight: 85,
      stale: dataQuality === DataQuality.STALE,
    }),
    [entries, dataQuality, theme.accent1, theme.accent3]
  )

  const cumulativeVolume = useMemo(() => getCumulativeVolume(entries), [entries])
  if (isSmallScreen) {
    return (
      <MinimalStatDisplay
        title={<Trans i18nKey="explore.uniVolume" />}
        value={cumulativeVolume}
        time={<Trans i18nKey="common.pastMonth" />}
      />
    )
  }

  return (
    <SectionContainer>
      <RowBetween>
        <SectionTitle>
          <Trans i18nKey="explore.uniVolume" />
        </SectionTitle>
        <div style={{ position: 'absolute', right: 0 }}>
          <StyledTimePeriodSelector
            options={TIME_SELECTOR_OPTIONS}
            timePeriod={timePeriod}
            onChangeTimePeriod={setTimePeriod}
          />
        </div>
      </RowBetween>
      {(() => {
        if (dataQuality === DataQuality.INVALID) {
          const errorText = loading ? undefined : <Trans i18nKey="explore.unableToDisplayHistorical" />
          return (
            <ChartSkeleton hideYAxis type={ChartType.VOLUME} height={EXPLORE_CHART_HEIGHT_PX} errorText={errorText} />
          )
        }
        return (
          <StyledChart Model={CustomVolumeChartModel<StackedHistogramData>} params={params}>
            {(crosshairData) => (
              <ChartHeader
                value={crosshairData ? getCumulativeSum(crosshairData) : getCumulativeVolume(entries)}
                time={crosshairData?.time}
                timePlaceholder={formatHistoryDuration(timeGranularityToHistoryDuration(timePeriod))}
                protocolData={getVolumeProtocolInfo(crosshairData, EXPLORE_PRICE_SOURCES)}
              />
            )}
          </StyledChart>
        )
      })()}
    </SectionContainer>
  )
}

function TVLChartSection({ chainId }: { chainId: SupportedInterfaceChainId }) {
  const theme = useTheme()

  const { entries, loading, dataQuality } = useDailyProtocolTVL(chainIdToBackendChain({ chainId }))
  const lastEntry = entries[entries.length - 1]
  const params = useMemo(
    () => ({
      data: entries,
      colors: EXPLORE_PRICE_SOURCES?.map((source) => getProtocolColor(source, theme)) ?? [theme.accent1],
    }),
    [entries, theme]
  )

  const isSmallScreen = !useScreenSize()['sm']
  if (isSmallScreen) {
    const currentTVL = lastEntry?.values.reduce((acc, curr) => acc + curr, 0)
    return <MinimalStatDisplay title={<Trans i18nKey="common.uniswapTVL" />} value={currentTVL} />
  }

  return (
    <SectionContainer>
      <SectionTitle>
        <Trans i18nKey="common.uniswapTVL" />
      </SectionTitle>
      {(() => {
        if (dataQuality === DataQuality.INVALID) {
          const errorText = loading ? undefined : <Trans i18nKey="explore.unableToDisplayHistoricalTVL" />
          return <ChartSkeleton hideYAxis type={ChartType.TVL} height={EXPLORE_CHART_HEIGHT_PX} errorText={errorText} />
        }

        return (
          <StyledChart Model={TVLChartModel} params={params}>
            {(crosshairData) => (
              <ChartHeader
                value={(crosshairData ?? lastEntry)?.values.reduce((v, sum) => (sum += v), 0)}
                time={crosshairData?.time}
                protocolData={EXPLORE_PRICE_SOURCES?.map((source, index) => ({
                  protocol: source,
                  value: crosshairData?.values[index],
                }))}
              />
            )}
          </StyledChart>
        )
      })()}
    </SectionContainer>
  )
}

function MinimalStatDisplay({ title, value, time }: { title: ReactNode; value: number; time?: ReactNode }) {
  const { formatFiatPrice } = useFormatter()

  return (
    <SectionContainer>
      <SectionTitle color="neutral2">{title}</SectionTitle>
      <ThemedText.HeadlineSmall fontSize="24px" lineHeight="32px">
        {formatFiatPrice({ price: value, type: NumberType.ChartFiatValue })}
      </ThemedText.HeadlineSmall>
      {time && <ThemedText.Caption color="neutral2">{time}</ThemedText.Caption>}
    </SectionContainer>
  )
}

export function ExploreChartsSection() {
  const chain = getSupportedGraphQlChain(useChainFromUrlParam(), { fallbackToEthereum: true })

  return (
    <ChartsContainer>
      <TVLChartSection chainId={chain.id} />
      <VolumeChartSection chainId={chain.id} />
    </ChartsContainer>
  )
}
