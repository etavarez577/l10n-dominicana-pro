odoo.define('ncf_pos.popups', function (require) {
    "use strict";


    var PopUpWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');
    var _t = require('web.core')._t;



    var DeliveryPopupWidget = PopUpWidget.extend({
        template: 'DeliveryPopupWidget',
        show: function (options) {
            this._super(options);

        }
    });
    gui.define_popup({name: 'DeliveryPopupWidget', widget: DeliveryPopupWidget});


    var QuotationPopupWidget = PopUpWidget.extend({
        template: 'QuotationPopupWidget',
        show: function (opts) {
            var self = this;
            this._super(opts);
            var order = self.pos.get_order();

            this.$("#print_pdf").click(function () {
                self.report_action("print", order);
            });

            this.$("#send_mail").click(function () {
                self.report_action("send", order);
            });

            this.$("#send_delivery").click(function () {
                //self.delivery_action("delivery", order);
                console.log("================")
                console.log(self)
                console.log("================")
                self.gui.show_popup('DeliveryPopupWidget');
            });

            this.$("#quotation_cancel").click(function () {
                self.gui.close_popup();
            })

        },
        report_action: function (action, order) {
            var self = this;
            order.set_quotation_type(action);

            var invoiced = self.push_and_quotation_order(order);

            invoiced.fail(function (error) {
                self.invoicing = false;

                if (error.message === 'Missing Customer') {
                    self.pos.gui.show_popup('confirm', {
                        'title': _t('Please select the Customer'),
                        'body': _t('You need to select the customer before you can invoice an order.'),
                        confirm: function () {
                            self.gui.show_screen('clientlist');
                        },
                    });
                }
                else if (error.message === 'Missing Customer Email') {
                    self.pos.gui.show_popup('confirm', {
                        'title': _t('Please select the Customer'),
                        'body': _t('You need to select the customer before you can invoice an order.'),
                        confirm: function () {
                            self.gui.show_screen('clientlist');
                        },
                    });
                }
                else if (error.code < 0) {        // XmlHttpRequest Errors
                    self.pos.gui.show_popup('error', {
                        'title': _t('The order could not be sent'),
                        'body': _t('Check your internet connection and try again.'),
                    });
                } else if (error.code === 200) {    // OpenERP Server Errors
                    self.pos.gui.show_popup('error-traceback', {
                        'title': error.data.message || _t("Server Error"),
                        'body': error.data.debug || _t('The server encountered an error while receiving your order.'),
                    });
                } else {                            // ???
                    self.pos.gui.show_popup('error', {
                        'title': _t("Unknown Error"),
                        'body': _t("The order could not be sent to the server due to an unknown error"),
                    });
                }
            });


            invoiced.done(function (res) {

                order.finalize();
                self.gui.close_popup();

            });

        },
        push_and_quotation_order: function (order) {
            var self = this;
            var invoiced = new $.Deferred();
            var pos = self.pos;

            if (!order.get_client()) {
                invoiced.reject({code: 400, message: 'Missing Customer', data: {}});
                return invoiced;
            }

            if (!order.get_client().email && order.get_quotation_type === 'send') {
                invoiced.reject({code: 400, message: 'Missing Customer Email', data: {}});
                return invoiced;
            }

            var order_id = pos.db.add_order(order.export_as_JSON());

            pos.flush_mutex.exec(function () {
                var done = new $.Deferred(); // holds the mutex

                var transfer = pos._flush_orders([pos.db.get_order(order_id)], {timeout: 30000, to_invoice: true});

                transfer.fail(function (error) {
                    invoiced.reject(error);
                    done.reject();
                });

                // on success, get the order id generated by the server
                transfer.pipe(function (order_server_id) {
                    pos.chrome.do_action(order_server_id);
                    invoiced.resolve();
                    done.resolve();
                });
                return done;

            });
            return invoiced;
        }
    });

    gui.define_popup({name: 'QuotationPopup', widget: QuotationPopupWidget});


});