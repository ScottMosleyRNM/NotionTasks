for (const page of response.results) {
  if (!("properties" in page)) continue;

  const props: any = page.properties;

  results.push({
    id: page.id,
    title:
      props["Task"]?.title?.[0]?.plain_text ||
      props["Task name"]?.title?.[0]?.plain_text ||
      "Untitled",
    due:
      props["Due"]?.date?.start ||
      props["Due date"]?.date?.start,
    status:
      props["Status"]?.status?.name ||
      props["Status"]?.select?.name ||
      "Unknown",
    assignee: props["Assignee"]?.people?.[0]?.name,
    databaseId: dbId,
    url: page.url,
  });
}
