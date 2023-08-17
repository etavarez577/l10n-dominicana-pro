from odoo import models, api, _
from odoo.exceptions import UserError

import logging
import json
import re
_logger = logging.getLogger(__name__)

try:
    from stdnum.do import rnc, cedula
except (ImportError, IOError) as err:
    _logger.debug(str(err))

class Partner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def create(self, vals):
        rnc = vals.get('name').replace('-', '') if vals.get('name', False) else vals.get('vat', False)

        if vals.get('country_id', False) == self.env.ref('base.do').id and rnc and rnc.isdigit():
            name = self.get_name_from_dgii(rnc)

            if name:
                vals.update({
                    'name': name,
                    'vat': rnc
                })

            else:

                raise UserError(_('This RNC or Cedula is not valid or not exist, please check it.'))

        return super(Partner, self).create(vals)

    @api.model_create_multi
    def create(self, vals_list):
        for val in vals_list:
            rnc = val.get('name').replace('-', '') if val.get('name', False) else val.get('vat', False)

            if val.get('country_id', False) == self.env.ref('base.do').id and rnc and rnc.isdigit():
                name = self.get_name_from_dgii(rnc)

                if name:
                    val.update({
                        'name': name,
                        'vat': rnc
                    })

                elif not name and val.get('vat', False):

                    raise UserError(
                        _('This RNC or Cedula (%s) could not be found, please confirm the RNC or Cedula number. If it is a system search error, enter manually the full company name and the RNC / Cedula in the field labeled RNC for companies and Cedula for individuals for force create the contact.') % (rnc))

        return super(Partner, self).create(vals_list)

    @api.onchange("vat")
    def _check_rnc(self):
        for partner in self:
            if partner.country_id and partner.country_id.code == 'DO' and partner.vat:
                name = self.get_name_from_dgii(partner.vat)
                
                if name:
                    partner.name = self.get_name_from_dgii(partner.vat)
                

    def get_name_from_dgii(self, vat):
        if (len(vat) not in [9, 11]):
            raise UserError(_('Please check the RNC/Cedula, it does not have the appropriate number of digits, only enter numbers (without hyphens), 9 digits for RNC and 11 digits for Cedula.'))
            
        elif (not ((len(vat) == 9 and rnc.is_valid(vat)) or (len(vat) == 11 and cedula.is_valid(vat)))):
            raise UserError(_('Check RNC/Cedula, seems like it is not correct'))
        
        else:
            result = rnc.check_dgii(vat)
            if result is not None:
                # remove all duplicate white space from the name
                result["name"] = " ".join(
                    re.split(r"\s+", result["name"], flags=re.UNICODE))
                
                return result["name"]
        
        return False