"use client";

import { TextField, TextAreaField, SelectField } from "../formPrimitives";
import { STATES, SITE_TYPES, SHADING_CONDITIONS, discomsForState } from "../types";
import type { ProposalFormValues } from "../types";
import type { FieldErrors } from "../validation";

interface Props {
  values: ProposalFormValues;
  errors: FieldErrors;
  set: <K extends keyof ProposalFormValues>(field: K, value: ProposalFormValues[K]) => void;
  touch: (field: keyof ProposalFormValues) => void;
}

export default function Step2InstallationSite({ values, errors, set, touch }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-5">
        <SelectField
          id="state"
          label="State"
          placeholder="Select state…"
          options={STATES}
          value={values.state}
          onChange={(v) => set("state", v)}
          onBlur={() => touch("state")}
          error={errors.state}
        />
        <TextField
          id="districtCity"
          label="District / City"
          placeholder="Hooghly"
          value={values.districtCity}
          onChange={(v) => set("districtCity", v)}
          onBlur={() => touch("districtCity")}
          error={errors.districtCity}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <TextField
          id="pinCode"
          label="PIN Code"
          inputMode="numeric"
          placeholder="712235"
          value={values.pinCode}
          onChange={(v) => set("pinCode", v)}
          onBlur={() => touch("pinCode")}
          error={errors.pinCode}
        />
        <TextField
          id="consumerNumber"
          label="Consumer Number"
          optional
          placeholder="Electricity meter consumer number"
          value={values.consumerNumber}
          onChange={(v) => set("consumerNumber", v)}
        />
      </div>

      <TextAreaField
        id="fullAddress"
        label="Full Site Address"
        optional
        rows={3}
        placeholder="House / plot number, street, landmark…"
        value={values.fullAddress}
        onChange={(v) => set("fullAddress", v)}
      />

      <div className="grid sm:grid-cols-2 gap-5">
        <SelectField
          id="discom"
          label="DISCOM / Electricity Board"
          placeholder={values.state ? "Select DISCOM…" : "Select a state first…"}
          options={discomsForState(values.state)}
          value={values.discom}
          onChange={(v) => set("discom", v)}
          onBlur={() => touch("discom")}
          error={errors.discom}
        />
        <SelectField
          id="siteType"
          label="Site Type"
          placeholder="Select site type…"
          options={SITE_TYPES}
          value={values.siteType}
          onChange={(v) => set("siteType", v)}
          onBlur={() => touch("siteType")}
          error={errors.siteType}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <TextField
          id="siteAreaSqFt"
          label="Roof / Site Area (sq ft)"
          inputMode="numeric"
          placeholder="800"
          value={values.siteAreaSqFt}
          onChange={(v) => set("siteAreaSqFt", v)}
          onBlur={() => touch("siteAreaSqFt")}
          error={errors.siteAreaSqFt}
        />
        <TextField
          id="numberOfFloors"
          label="Number of Floors"
          optional
          inputMode="numeric"
          placeholder="2"
          value={values.numberOfFloors}
          onChange={(v) => set("numberOfFloors", v)}
        />
      </div>

      <SelectField
        id="shadingConditions"
        label="Shadow / Shading Conditions"
        optional
        placeholder="Select shading condition…"
        options={SHADING_CONDITIONS}
        value={values.shadingConditions}
        onChange={(v) => set("shadingConditions", v)}
      />

      <TextAreaField
        id="structuralNotes"
        label="Structural Notes"
        optional
        rows={3}
        placeholder="e.g. concrete flat roof, metal truss roof, terrace access restricted…"
        value={values.structuralNotes}
        onChange={(v) => set("structuralNotes", v)}
      />
    </div>
  );
}
