"use client";

import { TextField, SelectField, ToggleGroup, YesNoToggle, SectionHeading } from "../formPrimitives";
import { PROJECT_TYPES, SCHEME_NAMES } from "../types";
import type { ProposalFormValues } from "../types";
import type { FieldErrors } from "../validation";

interface Props {
  values: ProposalFormValues;
  errors: FieldErrors;
  set: <K extends keyof ProposalFormValues>(field: K, value: ProposalFormValues[K]) => void;
  touch: (field: keyof ProposalFormValues) => void;
  leadIdLocked?: boolean;
}

export default function Step1CustomerProject({ values, errors, set, touch, leadIdLocked }: Props) {
  const isOrganisation = values.customerType === "organisation";

  return (
    <div className="space-y-8">
      <div>
        <SectionHeading>Customer</SectionHeading>
        <div className="space-y-6 mt-5">
          <ToggleGroup
            label="Customer Type"
            value={values.customerType}
            onChange={(v) => set("customerType", v)}
            options={[
              ["individual", "Individual"],
              ["organisation", "Organisation"],
            ]}
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <TextField
              id="fullName"
              label="Full Name"
              placeholder="Ravi Sharma"
              value={values.fullName}
              onChange={(v) => set("fullName", v)}
              onBlur={() => touch("fullName")}
              error={errors.fullName}
            />
            <TextField
              id="email"
              label="Email Address"
              type="email"
              placeholder="ravi@company.in"
              value={values.email}
              onChange={(v) => set("email", v)}
              onBlur={() => touch("email")}
              error={errors.email}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <TextField
              id="contactNumber"
              label="Contact Number"
              type="tel"
              placeholder="+91 98700 00000"
              value={values.contactNumber}
              onChange={(v) => set("contactNumber", v)}
              onBlur={() => touch("contactNumber")}
              error={errors.contactNumber}
            />
            <div>
              <TextField
                id="referenceLeadId"
                label="Lead ID"
                placeholder="e.g. 1042"
                value={values.referenceLeadId}
                onChange={(v) => set("referenceLeadId", v)}
                onBlur={() => touch("referenceLeadId")}
                error={errors.referenceLeadId}
                disabled={leadIdLocked}
              />
              {leadIdLocked && (
                <p className="mt-1.5 text-[#111827]/65 text-xs font-utility">
                  Locked — opened from this lead&rsquo;s dashboard page.
                </p>
              )}
            </div>
          </div>

          {isOrganisation && (
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                id="organisationName"
                label="Organisation Name"
                optional
                placeholder="Acme Industries Pvt. Ltd."
                value={values.organisationName}
                onChange={(v) => set("organisationName", v)}
              />
              <TextField
                id="gstNumber"
                label="GST Number"
                optional
                placeholder="19ABCDE1234F1Z5"
                value={values.gstNumber}
                onChange={(v) => set("gstNumber", v)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-[#e4e8ee]" />

      <div>
        <SectionHeading>Project</SectionHeading>
        <div className="space-y-6 mt-5">
          <SelectField
            id="projectType"
            label="Project Type"
            placeholder="Select project type…"
            options={PROJECT_TYPES}
            value={values.projectType}
            onChange={(v) => set("projectType", v)}
            onBlur={() => touch("projectType")}
            error={errors.projectType}
          />

          <YesNoToggle
            label="Is this project linked to a government scheme?"
            value={values.linkedToGovtScheme}
            onChange={(v) => set("linkedToGovtScheme", v)}
          />

          {values.linkedToGovtScheme === "yes" && (
            <SelectField
              id="schemeName"
              label="Scheme Name"
              optional
              placeholder="Select scheme…"
              options={SCHEME_NAMES}
              value={values.schemeName}
              onChange={(v) => set("schemeName", v)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
