import { Type, type Static } from "@sinclair/typebox";
import type { NylasClient } from "../client.js";

// =============================================================================
// List Contacts Tool
// =============================================================================

export const ListContactsSchema = Type.Object({
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
  email: Type.Optional(Type.String({ description: "Filter by email address" })),
  phone_number: Type.Optional(Type.String({ description: "Filter by phone number" })),
  source: Type.Optional(Type.String({ description: "Filter by source (e.g., 'address_book', 'domain_contact')" })),
  group: Type.Optional(Type.String({ description: "Filter by contact group ID" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 25, max: 100)" })),
  page_token: Type.Optional(Type.String({ description: "Pagination token for next page" })),
});

export type ListContactsParams = Static<typeof ListContactsSchema>;

export async function listContacts(client: NylasClient, params: ListContactsParams) {
  const limit = Math.min(params.limit ?? 25, 100);

  const response = await client.listContacts({
    grant: params.grant,
    limit,
    pageToken: params.page_token,
    email: params.email,
    phoneNumber: params.phone_number,
    source: params.source,
    group: params.group,
  });

  const contacts = response.data.map((contact) => {
    const name = [contact.givenName, contact.middleName, contact.surname]
      .filter(Boolean)
      .join(" ") || contact.nickname;

    return {
      id: contact.id,
      name: name || "(no name)",
      company: contact.companyName,
      job_title: contact.jobTitle,
      emails: contact.emails?.map((e) => ({ email: e.email, type: e.type })),
      phone_numbers: contact.phoneNumbers?.map((p) => ({ number: p.number, type: p.type })),
      source: contact.source,
    };
  });

  return {
    contacts,
    has_more: !!response.nextCursor,
    next_page_token: response.nextCursor,
    count: contacts.length,
  };
}

// =============================================================================
// Get Contact Tool
// =============================================================================

export const GetContactSchema = Type.Object({
  contact_id: Type.String({ description: "The contact ID" }),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type GetContactParams = Static<typeof GetContactSchema>;

export async function getContact(client: NylasClient, params: GetContactParams) {
  const response = await client.getContact(params.contact_id, params.grant);
  const contact = response.data;

  const name = [contact.givenName, contact.middleName, contact.surname]
    .filter(Boolean)
    .join(" ") || contact.nickname;

  return {
    id: contact.id,
    name: name || "(no name)",
    given_name: contact.givenName,
    middle_name: contact.middleName,
    surname: contact.surname,
    nickname: contact.nickname,
    company: contact.companyName,
    job_title: contact.jobTitle,
    emails: contact.emails?.map((e) => ({ email: e.email, type: e.type })),
    phone_numbers: contact.phoneNumbers?.map((p) => ({ number: p.number, type: p.type })),
    addresses: contact.physicalAddresses?.map((a) => ({
      street: a.streetAddress,
      city: a.city,
      state: a.state,
      postal_code: a.postalCode,
      country: a.country,
      type: a.type,
    })),
    notes: contact.notes,
    birthday: contact.birthday,
    picture_url: contact.pictureUrl,
    source: contact.source,
    groups: contact.groups?.map((g) => ({ id: g.id })),
  };
}
