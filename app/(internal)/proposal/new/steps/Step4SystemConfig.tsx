"use client";

import { SelectField, ToggleGroup, YesNoToggle, TextAreaField } from "../formPrimitives";
import { BACKUP_DURATIONS, EQUIPMENT_TIERS } from "../types";
import type { ProposalFormValues } from "../types";
import { usePackageCatalogue } from "@/lib/pricing/usePackageCatalogue";
import { equipmentTierLabels } from "@/lib/pricing/tier-labels";

interface Props {
  values: ProposalFormValues;
  set: <K extends keyof ProposalFormValues>(field: K, value: ProposalFormValues[K]) => void;
  dcrAutoSet: boolean;
}

export default function Step4SystemConfig({ values, set, dcrAutoSet }: Props) {
  const needsBackupDuration = values.connectionType === "off-grid" || values.connectionType === "hybrid";
  const isOnGrid = values.connectionType === "on-grid";
  const { catalogue } = usePackageCatalogue();
  const showBatteryToggle = values.connectionType !== "hybrid";

  return (
    <div className="space-y-6">
      <ToggleGroup
        label="Connection Type"
        value={values.connectionType}
        onChange={(v) => set("connectionType", v)}
        options={[
          ["on-grid", "Grid-Connected (On-Grid)"],
          ["off-grid", "Off-Grid (Standalone)"],
          ["hybrid", "Hybrid (Grid + Battery)"],
        ]}
      />

      {needsBackupDuration && (
        <SelectField
          id="backupDuration"
          label="Backup Duration Required"
          optional
          placeholder="Select backup duration…"
          options={BACKUP_DURATIONS}
          value={values.backupDuration}
          onChange={(v) => set("backupDuration", v)}
        />
      )}

      {isOnGrid && (
        <YesNoToggle
          label="Net Metering Required"
          value={values.netMeteringRequired}
          onChange={(v) => set("netMeteringRequired", v)}
          optional
        />
      )}

      <SelectField
        id="preferredEquipmentTier"
        label="Preferred Equipment Tier"
        optional
        placeholder="Select equipment tier…"
        options={EQUIPMENT_TIERS}
        labels={equipmentTierLabels(catalogue)}
        value={values.preferredEquipmentTier}
        onChange={(v) => set("preferredEquipmentTier", v)}
      />

      <YesNoToggle
        label="DCR (Domestically Manufactured) Panels Required"
        value={values.dcrRequired}
        onChange={(v) => set("dcrRequired", v)}
        disabled={dcrAutoSet}
        optional
        note={
          dcrAutoSet
            ? "Automatically set to Yes because this project is linked to a government scheme — DCR panels are mandatory for PM Surya Ghar and other government programmes."
            : undefined
        }
      />

      <YesNoToggle
        label="EV Charging Integration"
        value={values.evChargingIntegration}
        onChange={(v) => set("evChargingIntegration", v)}
        optional
      />

      {showBatteryToggle && (
        <YesNoToggle
          label="Battery Storage Integration"
          value={values.batteryStorageIntegration}
          onChange={(v) => set("batteryStorageIntegration", v)}
          optional
        />
      )}

      <TextAreaField
        id="additionalRequirements"
        label="Additional Requirements"
        optional
        rows={3}
        placeholder="Anything else Grid Nova's engineering team should know…"
        value={values.additionalRequirements}
        onChange={(v) => set("additionalRequirements", v)}
      />
    </div>
  );
}
