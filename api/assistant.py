import os
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError

from api._lib._cors import handle_options, require_cors
from api._lib._responses import read_json, send_error, send_json
from api._lib._rate_limit import require_rate_limit
from api._lib._assistant import validate_question, retrieve, fallback_reply, generate_reply, product_card, UNRELATED, DECLINE


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):handle_options(self,'GET,POST,OPTIONS','Content-Type')

    def do_GET(self):
        cors=None
        try:
            cors=require_cors(self,'GET,POST,OPTIONS','Content-Type')
            send_json(self,200,{'available':True,'conversational':bool(os.environ.get('GEMINI_API_KEY'))},cors)
        except Exception as error:send_error(self,error,cors)

    def do_POST(self):
        cors=None
        try:
            cors=require_cors(self,'GET,POST,OPTIONS','Content-Type')
            require_rate_limit(self,'assistant-chat');require_rate_limit(self,'assistant-day')
            question,previous,product_id,selected_color=validate_question(read_json(self,8*1024))
            if UNRELATED.search(question):
                return send_json(self,200,{'reply':DECLINE,'products':[],'mode':'catalog'},cors)
            context=retrieve(question,previous,product_id,selected_color)
            reply,ids=fallback_reply(context);mode='catalog'
            if os.environ.get('GEMINI_API_KEY') and context['kind'] in ('search','size','detail'):
                try:
                    require_rate_limit(self,'assistant-generate',subject='store')
                    reply,ids=generate_reply(question,previous,context);mode='gemini'
                except Exception as error:
                    # Do not log questions, provider bodies, authorization headers or keys.
                    print('Assistant generation fallback: '+(f'HTTP {error.code}' if isinstance(error,HTTPError) else type(error).__name__))
            by_id={p['id']:p for p in context['products']}
            send_json(self,200,{'reply':reply,'products':[product_card(by_id[pid]) for pid in ids if pid in by_id],'mode':mode},cors)
        except Exception as error:send_error(self,error,cors)

    def log_message(self,*args):pass
