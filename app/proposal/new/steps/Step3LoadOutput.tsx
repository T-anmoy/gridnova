"use client";

import { TextField, TextAreaField, SelectField } from "../formPrimitives";
import { CONNECTION_PHASES, PRIMARY_OBJECTIVES } from "../types";
import type { ProposalFormValues } from "../types";
import type { FieldErrors } from "../validation";

interface Props {
  values: ProposalFormValues;
  errors: FieldErrors;
  set: <K extends keyof ProposalFormValues>(field: K, value: ProposalFormValues[K]) => void;
  touch: (field: keyof ProposalFormValues) => void;
}

export default function Step3LoadOutput({ values, errors, set, touch }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-5">
        <TextField
          id="avgMonthlyBill"
          label="Average Monthly Electricity Bill (₹)"
          inputMode="numeric"
          placeholder="3500"
          value={values.avgMonthlyBill}
          onChange={(v) => set("avgMonthlyBill", v)}
          onBlur={() => touch("avgMonthlyBill")}
          error={errors.avgMonthlyBill}
        />
        <TextField
          id="avgMonthlyUnits"
          label="Average Monthly Units Consumed (kWh)"
          optional
          inputMode="numeric"
          placeholder="e.g. 350"
          value={values.avgMonthlyUnits}
          onChange={(v) => set("avgMonthlyUnits", v)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <TextField
          id="peakLoad"
          label="Peak Load / Sanctioned Load (kW)"
          optional
          inputMode="numeric"
          placeholder="e.g. 5"
          value={values.peakLoad}
          onChange={(v) => set("peakLoad", v)}
        />
        <SelectField
          id="connectionPhase"
          label="Connection Phase"
          placeholder="Select connection phase…"
          options={CONNECTION_PHASES}
          value={values.connectionPhase}
          onChange={(v) => set("connectionPhase", v)}
          onBlur={() => touch("connectionPhase")}
          error={errors.connectionPhase}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <SelectField
          id="primaryObjective"
          label="Primary Objective"
          placeholder="Select primary objective…"
          options={PRIMARY_OBJECTIVES}
          value={values.primaryObjective}
          onChange={(v) => set("primaryObjective", v)}
          onBlur={() => touch("primaryObjective")}
          error={errors.primaryObjective}
        />
        <TextField
          id="desiredSystemOutput"
          label="Desired System Output (kW)"
          optional
          inputMode="numeric"
          placeholder="If you already have a size in mind"
          value={values.desiredSystemOutput}
          onChange={(v) => set("desiredSystemOutput", v)}
        />
      </div>

      <TextAreaField
        id="specialLoadNotes"
        label="Special Load Notes"
        optional
        rows={3}
        placeholder="e.g. EV charger planned, industrial machinery with high startup current…"
        value={values.specialLoadNotes}
        onChange={(v) => set("specialLoadNotes", v)}
      />
    </div>
  );
}
