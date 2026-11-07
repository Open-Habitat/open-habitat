import type { Meta, StoryObj } from "@storybook/react-vite";
import { ControlButton } from "./ControlElements";
import { NumberStepper } from "./NumberStepper";
import {
  LimitReset,
  PeopleList,
  PeopleRow,
  SectionCard,
  SectionLead,
  SectionMeter,
  SectionNumber,
  SectionStatus,
  SectionSubhead,
  ServerSection,
  UsageFigure,
} from "./ServerSection";
import { StatusMark } from "./Status";

// The parts a Palvelimen ylläpito section is written from, in the states
// the sections use: a meter within and over the whole, limits with their
// own and the default value, readings in a column, and a list whose rows
// end in actions, at a wide, a settings-pane and a phone width. Synthetic
// figures; nothing is written.
const GiB = 2 ** 30;
const noop = () => {};

function Section({
  width,
  over,
  actions,
}: {
  width: number;
  over?: boolean;
  actions?: boolean;
}) {
  const people = [
    { name: "aino", used: 14.2, limit: 40, own: true },
    { name: "anna", used: 18.4, limit: 20, own: false },
    { name: "mikko", used: 1.4, limit: 20, own: false },
  ];
  return (
    <div style={{ padding: 24, maxWidth: width }}>
      <ServerSection>
        <SectionLead>
          Henkilöiden kotihakemistot jakavat yhden levyn. Raja koskee yhden
          henkilön kotihakemistoa.
        </SectionLead>
        <SectionCard>
          <SectionMeter
            label="Levy"
            figure="500 GiB yhteensä · 420 GiB vapaana"
            total={500 * GiB}
            meterLabel="Käytössä nyt 80 GiB / 500 GiB"
            now={{ label: "Käytössä nyt", value: "80 GiB", amount: 80 * GiB }}
            worst={{
              label: "Jos jokainen täyttää rajansa",
              value: over ? "620 GiB" : "120 GiB",
              amount: (over ? 620 : 120) * GiB,
            }}
            over={
              over
                ? "Rajojen summa ylittää levyn koon. Se on sallittua, mutta levy voi täyttyä."
                : undefined
            }
          />
          <SectionNumber
            label="Oletusraja"
            description="Uusien käyttäjien raja. Ei muuta nykyisiä."
            value={20}
            min={1}
            max={500}
            step={5}
            unit="GiB"
            onChange={noop}
          />
        </SectionCard>
        <SectionSubhead>Henkilöt</SectionSubhead>
        <SectionCard>
          {actions ? (
            <PeopleList actions columns={["Henkilö", "Rooli"]}>
              {people.map((p) => (
                <PeopleRow
                  key={p.name}
                  name={`@${p.name}`}
                  detail={<span className="s-desc">Unix {p.name}</span>}
                  cells={[
                    <StatusMark
                      key="role"
                      tone="success"
                      label={p.own ? "Ylläpitäjä" : "Käyttäjä"}
                    />,
                  ]}
                  end={
                    <>
                      <ControlButton size="row" variant="quiet">
                        Tee ylläpitäjäksi
                      </ControlButton>
                      <ControlButton size="row" variant="quiet">
                        Poista pääsy
                      </ControlButton>
                    </>
                  }
                />
              ))}
            </PeopleList>
          ) : (
            <PeopleList columns={["Henkilö", "Käytössä", "Raja"]}>
              {people.map((p) => (
                <PeopleRow
                  key={p.name}
                  data-own={p.own ? "" : undefined}
                  name={p.name}
                  detail={
                    <span className="s-desc">
                      {p.own ? "oma raja" : "oletus"}
                    </span>
                  }
                  cells={[
                    <UsageFigure
                      key="use"
                      used={p.used}
                      limit={p.limit}
                      text={`${p.used} GiB / ${p.limit} GiB`}
                    />,
                    <LimitReset
                      key="limit"
                      own={p.own}
                      label="Palauta oletukseen (20 GiB)"
                      name={`Palauta oletukseen (20 GiB): ${p.name}`}
                      onPress={noop}
                    >
                      <NumberStepper
                        label={`Raja: ${p.name}`}
                        value={p.limit}
                        min={1}
                        max={500}
                        step={5}
                        onChange={noop}
                      />
                    </LimitReset>,
                  ]}
                />
              ))}
            </PeopleList>
          )}
        </SectionCard>
        <SectionStatus />
      </ServerSection>
    </div>
  );
}

const meta = {
  title: "Settings/Palvelinosion osat",
  component: Section,
  args: { width: 760 },
} satisfies Meta<typeof Section>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Wide: Story = {};
export const SettingsPane: Story = { args: { width: 440 } };
export const Phone: Story = { args: { width: 340 } };
export const LimitsExceedTheDisk: Story = { args: { over: true } };
export const RowsWithActions: Story = { args: { actions: true } };
export const RowsWithActionsInThePane: Story = {
  args: { actions: true, width: 440 },
};
