---
name: terraform_validator
description: "Validates and lints Terraform HCL configurations using local CLI tools."
---

# Terraform Validator Skill

Run the following terminal commands to validate Terraform assets:

```bash
cd $TARGET_APP_DIR/infra/terraform
terraform fmt -check
terraform init -backend=false
terraform validate
tflint
tfsec .
```

If any check fails, return the exact error line and variable name so the IaC Engineer can rectify the issue immediately.
