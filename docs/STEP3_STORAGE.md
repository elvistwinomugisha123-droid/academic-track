# Step 3 private storage contract

Step 3 uses three private Supabase Storage buckets:

- `school-files` for school templates and controlled uploads;
- `school-exports` for generated school-owned exports;
- `restricted-files` for restricted institutional files.

Buckets must be created as private through the Supabase dashboard or Storage API. The application must not mutate Supabase's managed `storage` schema through SQL migrations.

Objects use this path shape:

```text
{school_id}/{file_kind}/{stable_file_id}/{sanitized_filename}
```

The path is not an authorization boundary. Upload, download, replacement, and deletion must first authorize the `school_files` metadata row and then use Storage RLS. Private downloads use an authenticated request or a short-lived signed URL. Signed URL expiry is not treated as immediate revocation.

Initial policy direction:

- no public buckets;
- no arbitrary bucket or school path from the client;
- conservative document MIME allowlist and size limit configured by the application;
- school membership required for ordinary access;
- restricted files require the relevant role/action policy;
- service-role access is server-only and limited to trusted system operations.
